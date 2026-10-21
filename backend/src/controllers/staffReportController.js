import * as staffRepo from '../repositories/staffReportRepository.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getQueue = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const reports = await staffRepo.getStaffReportsQueue({ status, page, limit });
    return sendSuccess(res, reports, 'Staff report queue retrieved');
  } catch (error) {
    next(error);
  }
};

export const assignReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const officerUserId = req.user.user_id;

    const report = await staffRepo.assignReportToOfficer(reportId, officerUserId);

    if (!report) {
      return sendError(res, 'NOT_FOUND', 'Report not found or not assignable', 404);
    }

    return sendSuccess(res, report, 'Report assigned successfully');
  } catch (error) {
    next(error);
  }
};

export const requestInfo = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return sendError(res, 'VALIDATION_ERROR', 'Information request note is required', 400);
    }

    const report = await staffRepo.requestMoreInfo(reportId, note.trim());

    if (!report) {
      return sendError(res, 'NOT_FOUND', 'Report not found', 404);
    }

    return sendSuccess(res, report, 'Information requested successfully');
  } catch (error) {
    next(error);
  }
};

export const rejectReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return sendError(res, 'VALIDATION_ERROR', 'Rejection reason is required', 400);
    }

    const report = await staffRepo.rejectReport(reportId, rejection_reason.trim());

    if (!report) {
      return sendError(res, 'NOT_FOUND', 'Report not found or already approved', 404);
    }

    return sendSuccess(res, report, 'Report rejected successfully');
  } catch (error) {
    next(error);
  }
};

export const approveReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const caseData = req.body || {};

    const result = await staffRepo.approveReportAndCreateCase(reportId, caseData);

    if (!result) {
      return sendError(res, 'NOT_FOUND', 'Report not found', 404);
    }

    return sendSuccess(res, result, 'Report approved and case created successfully', 201);
  } catch (error) {
    if (error.code === 'ALREADY_APPROVED') {
      return sendError(res, 'CONFLICT', 'Report is already approved', 409);
    }
    next(error);
  }
};