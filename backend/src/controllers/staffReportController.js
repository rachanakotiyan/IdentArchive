import { z } from 'zod';
import * as staffRepo from '../repositories/staffReportRepository.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

// Must match the crime_type ENUM in 001_create_schema.sql exactly
const CRIME_TYPES = ['missing_person', 'unidentified_person', 'abduction', 'runaway', 'trafficking', 'other']

/**
 * Whitelist schema for POST /api/staff/reports/:id/approve
 * Only whitelisted fields are accepted; everything else is stripped by zod .strip() (default).
 */
const approveReportSchema = z.object({
  title: z.string().max(255).optional(),
  short_description: z.string().max(500).optional(),
  crime_type: z.enum(CRIME_TYPES).optional(),
  case_status: z.enum(['open', 'under_review']).optional(),
})

export const getQueue = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const reports = await staffRepo.getStaffReportsQueue({ status, page, limit });
    return sendSuccess(res, reports, 200, 'Staff report queue retrieved');
  } catch (error) {
    return next(error);
  }
};

export const assignReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const report = await staffRepo.assignReportToOfficer(reportId, req.user.userId, req.user.userId);

    if (!report) {
      throw new AppError('Report not found, not assignable, or officer is inactive.', 404, 'NOT_FOUND');
    }

    return sendSuccess(res, report, 200, 'Report assigned successfully');
  } catch (error) {
    return next(error);
  }
};

export const requestInfo = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { note } = req.body || {};

    if (typeof note !== 'string' || !note.trim()) {
      throw new AppError('Information request note is required.', 400, 'VALIDATION_ERROR');
    }

    const report = await staffRepo.requestMoreInfo(reportId, note.trim(), req.user.userId);

    if (!report) {
      throw new AppError('Report not found or not reviewable.', 404, 'NOT_FOUND');
    }

    return sendSuccess(res, report, 200, 'Information requested successfully');
  } catch (error) {
    return next(error);
  }
};

export const rejectReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { rejection_reason } = req.body || {};

    if (typeof rejection_reason !== 'string' || !rejection_reason.trim()) {
      throw new AppError('Rejection reason is required.', 400, 'VALIDATION_ERROR');
    }

    const report = await staffRepo.rejectReport(reportId, rejection_reason.trim(), req.user.userId);

    if (!report) {
      throw new AppError('Report not found or not reviewable.', 404, 'NOT_FOUND');
    }

    return sendSuccess(res, report, 200, 'Report rejected successfully');
  } catch (error) {
    return next(error);
  }
};

export const approveReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;

    // Validate and whitelist the request body; invalid enum values → 400
    const parsed = approveReportSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details)
    }

    // Only whitelisted keys are passed to the repository
    const caseData = parsed.data

    const result = await staffRepo.approveReportAndCreateCase(reportId, caseData, req.user.userId);

    if (!result) {
      throw new AppError('Report not found.', 404, 'NOT_FOUND');
    }

    return sendSuccess(res, result, 201, 'Report approved and case created successfully');
  } catch (error) {
    if (error.code === 'ALREADY_APPROVED') {
      return next(new AppError('Report is already approved.', 409, 'CONFLICT'));
    }
    if (error.code === 'INVALID_REPORT_STATUS') {
      return next(new AppError('Report cannot be approved from its current status.', 409, 'CONFLICT'));
    }
    return next(error);
  }
};