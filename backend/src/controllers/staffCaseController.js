import { z } from 'zod'
import * as staffCaseRepo from '../repositories/staffCaseRepository.js'
import * as officerRepo from '../repositories/officerRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

const addUpdateSchema = z.object({
  note: z.string().min(1, 'Note is required').max(255, 'Note cannot exceed 255 characters'),
  update_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'update_date must be YYYY-MM-DD').optional(),
})

const assignCaseSchema = z.object({
  officer_id: z.string().min(1, 'officer_id is required'),
})

const updateStatusSchema = z.object({
  status: z.enum(['open', 'under_review', 'resolved']).optional(),
  case_status: z.enum(['open', 'under_review', 'resolved']).optional(),
}).refine((data) => data.status || data.case_status, {
  message: 'status must be one of: open, under_review, resolved',
})

const closeCaseSchema = z.object({
  note: z.string().min(1, 'Closing note/reason is required').optional(),
  reason: z.string().min(1, 'Closing note/reason is required').optional(),
}).refine((data) => data.note || data.reason, {
  message: 'Closing note or reason is required',
})

async function getCallerOfficer(req) {
  if (req.user?.role === 'officer') {
    return officerRepo.findByUserId(req.user.userId)
  }
  return null
}

async function assertCaseAccess(caseItem, req) {
  if (req.user.role === 'officer') {
    const officer = await getCallerOfficer(req)
    if (caseItem.assigned_officer_id !== null && caseItem.assigned_officer_id !== officer?.officer_id) {
      throw new AppError('Access denied to case assigned to another officer.', 403, 'FORBIDDEN')
    }
  }
}

export const listCases = async (req, res, next) => {
  try {
    const {
      case_status,
      status,
      kind,
      case_type,
      q,
      query,
      page = 1,
      limit = 20,
      pageSize,
    } = req.query

    const officer = await getCallerOfficer(req)

    const cases = await staffCaseRepo.listStaffCases({
      case_status,
      status,
      kind,
      case_type,
      q,
      query,
      page,
      limit,
      pageSize,
      user: req.user,
      officerId: officer?.officer_id,
    })

    const meta = {
      total: cases.total ?? cases.length,
      page: cases.page ?? Math.max(1, Math.trunc(Number(page) || 1)),
      limit: cases.limit ?? Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20))),
      totalPages: cases.totalPages ?? 1,
    }

    return sendSuccess(res, cases, 200, 'Staff cases retrieved successfully', meta)
  } catch (error) {
    return next(error)
  }
}

export const getCaseDetail = async (req, res, next) => {
  try {
    const { caseId } = req.params
    if (!caseId || !String(caseId).trim()) {
      throw new AppError('caseId is required.', 400, 'VALIDATION_ERROR')
    }

    const caseItem = await staffCaseRepo.getStaffCaseDetail(String(caseId).trim())
    if (!caseItem) {
      throw new AppError('Case not found.', 404, 'NOT_FOUND')
    }

    await assertCaseAccess(caseItem, req)

    return sendSuccess(res, caseItem, 200, 'Case detail retrieved successfully')
  } catch (error) {
    return next(error)
  }
}

export const addUpdate = async (req, res, next) => {
  try {
    const { caseId } = req.params
    const parsed = addUpdateSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const caseItem = await staffCaseRepo.getStaffCaseDetail(caseId)
    if (!caseItem) {
      throw new AppError('Case not found.', 404, 'NOT_FOUND')
    }

    await assertCaseAccess(caseItem, req)

    const update = await staffCaseRepo.addCaseUpdate(
      caseItem.case_id,
      parsed.data.note,
      parsed.data.update_date
    )

    return sendSuccess(res, update, 201, 'Case update created successfully')
  } catch (error) {
    return next(error)
  }
}

export const assignCase = async (req, res, next) => {
  try {
    const { caseId } = req.params

    if (req.user?.role !== 'admin') {
      throw new AppError('Only administrators can assign cases.', 403, 'FORBIDDEN')
    }

    const parsed = assignCaseSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const updated = await staffCaseRepo.assignCaseOfficer(
      caseId,
      parsed.data.officer_id,
      req.user.userId
    )

    return sendSuccess(res, updated, 200, 'Case assigned successfully')
  } catch (error) {
    return next(error)
  }
}

export const updateStatus = async (req, res, next) => {
  try {
    const { caseId } = req.params
    const parsed = updateStatusSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const caseItem = await staffCaseRepo.getStaffCaseDetail(caseId)
    if (!caseItem) {
      throw new AppError('Case not found.', 404, 'NOT_FOUND')
    }

    await assertCaseAccess(caseItem, req)

    const effectiveStatus = parsed.data.status || parsed.data.case_status
    const updated = await staffCaseRepo.updateCaseStatus(caseItem.case_id, effectiveStatus)

    return sendSuccess(res, updated, 200, 'Case status updated successfully')
  } catch (error) {
    return next(error)
  }
}

export const closeCase = async (req, res, next) => {
  try {
    const { caseId } = req.params
    const parsed = closeCaseSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const caseItem = await staffCaseRepo.getStaffCaseDetail(caseId)
    if (!caseItem) {
      throw new AppError('Case not found.', 404, 'NOT_FOUND')
    }

    await assertCaseAccess(caseItem, req)

    const effectiveNote = parsed.data.note || parsed.data.reason
    const updated = await staffCaseRepo.closeCase(caseItem.case_id, effectiveNote, req.user.userId)

    return sendSuccess(res, updated, 200, 'Case closed successfully')
  } catch (error) {
    return next(error)
  }
}

