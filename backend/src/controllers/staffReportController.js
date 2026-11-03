import { z } from 'zod'
import * as staffRepo from '../repositories/staffReportRepository.js'
import * as officerRepo from '../repositories/officerRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

const CRIME_TYPES = ['missing_person', 'unidentified_person', 'abduction', 'runaway', 'trafficking', 'other']

const approveReportSchema = z.object({
  title: z.string().max(255).optional(),
  short_description: z.string().max(500).optional(),
  crime_type: z.enum(CRIME_TYPES).optional(),
  case_status: z.enum(['open', 'under_review']).optional(),
})

const prioritySchema = z.object({
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
})

const adminAssignSchema = z.object({
  officer_id: z.string().min(1, 'officer_id is required'),
})

async function getCallerOfficer(req) {
  if (req.user?.role === 'officer') {
    const officer = await officerRepo.findByUserId(req.user.userId)
    return officer || null
  }
  return null
}

export const getQueue = async (req, res, next) => {
  try {
    const {
      status,
      priority,
      assigned,
      q,
      query,
      report_type,
      type,
      page = 1,
      limit = 20,
      pageSize,
    } = req.query

    const officer = await getCallerOfficer(req)

    const reports = await staffRepo.getStaffReportsQueue({
      status,
      priority,
      assigned,
      q,
      query,
      report_type,
      type,
      page,
      limit,
      pageSize,
      user: req.user,
      officerId: officer?.officer_id,
    })

    const meta = {
      total: reports.total ?? reports.length,
      page: reports.page ?? Math.max(1, Math.trunc(Number(page) || 1)),
      limit: reports.limit ?? Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20))),
      totalPages: reports.totalPages ?? 1,
    }

    return sendSuccess(res, reports, 200, 'Staff report queue retrieved', meta)
  } catch (error) {
    return next(error)
  }
}

export const getReportById = async (req, res, next) => {
  try {
    const { reportId } = req.params
    if (!reportId || !String(reportId).trim()) {
      throw new AppError('reportId is required.', 400, 'VALIDATION_ERROR')
    }

    const report = await staffRepo.getStaffReportById(String(reportId).trim())
    if (!report) {
      throw new AppError('Report not found.', 404, 'NOT_FOUND')
    }

    // Officer scoping check: can only see assigned to them or unassigned
    if (req.user.role === 'officer') {
      const officer = await getCallerOfficer(req)
      if (report.assigned_officer_id !== null && report.assigned_officer_id !== officer?.officer_id) {
        throw new AppError('Access denied to report assigned to another officer.', 403, 'FORBIDDEN')
      }
    }

    return sendSuccess(res, report, 200, 'Staff report retrieved successfully')
  } catch (error) {
    return next(error)
  }
}

export const updatePriority = async (req, res, next) => {
  try {
    const { reportId } = req.params
    const parsed = prioritySchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const report = await staffRepo.getStaffReportById(reportId)
    if (!report) {
      throw new AppError('Report not found.', 404, 'NOT_FOUND')
    }

    // Officer scoping check
    if (req.user.role === 'officer') {
      const officer = await getCallerOfficer(req)
      if (report.assigned_officer_id !== null && report.assigned_officer_id !== officer?.officer_id) {
        throw new AppError('Officers cannot modify reports assigned to another officer.', 403, 'FORBIDDEN')
      }
    }

    const updated = await staffRepo.setReportPriority(reportId, parsed.data.priority, req.user.userId)
    return sendSuccess(res, updated, 200, 'Report priority updated successfully')
  } catch (error) {
    return next(error)
  }
}

export const assignReport = async (req, res, next) => {
  try {
    const { reportId } = req.params
    let targetOfficerId = null

    const callerRole = req.user.role
    const officer = await getCallerOfficer(req)

    if (callerRole === 'admin') {
      const parsed = adminAssignSchema.safeParse(req.body || {})
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          field: i.path.join('.') || 'body',
          message: i.message,
        }))
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
      }
      targetOfficerId = parsed.data.officer_id
    } else if (callerRole === 'officer') {
      if (!officer) {
        throw new AppError('Active officer profile required.', 403, 'FORBIDDEN')
      }
      targetOfficerId = officer.officer_id
    }

    const result = await staffRepo.assignReport({
      reportId,
      callerRole,
      callerUserId: req.user.userId,
      callerOfficerId: officer?.officer_id,
      targetOfficerId,
    })

    return sendSuccess(res, result, 200, 'Report assigned successfully')
  } catch (error) {
    return next(error)
  }
}

export const requestInfo = async (req, res, next) => {
  try {
    const { reportId } = req.params
    const { note } = req.body || {}

    if (typeof note !== 'string' || !note.trim()) {
      throw new AppError('Information request note is required.', 400, 'VALIDATION_ERROR')
    }

    const officer = await getCallerOfficer(req)
    const report = await staffRepo.requestMoreInfo(
      reportId,
      note.trim(),
      req.user.userId,
      req.user.role,
      officer?.officer_id
    )

    if (!report) {
      throw new AppError('Report not found or not reviewable.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, report, 200, 'Information requested successfully')
  } catch (error) {
    return next(error)
  }
}

export const rejectReport = async (req, res, next) => {
  try {
    const { reportId } = req.params
    const { rejection_reason } = req.body || {}

    if (typeof rejection_reason !== 'string' || !rejection_reason.trim()) {
      throw new AppError('Rejection reason is required.', 400, 'VALIDATION_ERROR')
    }

    const officer = await getCallerOfficer(req)
    const report = await staffRepo.rejectReport(
      reportId,
      rejection_reason.trim(),
      req.user.userId,
      req.user.role,
      officer?.officer_id
    )

    if (!report) {
      throw new AppError('Report not found or not reviewable.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, report, 200, 'Report rejected successfully')
  } catch (error) {
    return next(error)
  }
}

export const approveReport = async (req, res, next) => {
  try {
    const { reportId } = req.params

    const parsed = approveReportSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const officer = await getCallerOfficer(req)
    const caseData = parsed.data

    const result = await staffRepo.approveReportAndCreateCase(
      reportId,
      caseData,
      req.user.userId,
      req.user.role,
      officer?.officer_id
    )

    if (!result) {
      throw new AppError('Report not found.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, result, 201, 'Report approved and case created successfully')
  } catch (error) {
    if (error.code === 'ALREADY_APPROVED') {
      return next(new AppError('Report is already approved.', 409, 'CONFLICT'))
    }
    if (error.code === 'INVALID_REPORT_STATUS') {
      return next(new AppError('Report cannot be approved from its current status.', 409, 'CONFLICT'))
    }
    return next(error)
  }
}
