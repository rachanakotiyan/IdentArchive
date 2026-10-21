import * as staffRepo from '../repositories/staffReportRepository.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

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
    const caseData = req.body || {};

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