import * as reportRepo from '../repositories/reportRepository.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const submitReport = async (req, res, next) => {
  try {
    const { report_type, subject_name, contact_email, tracking_pin } = req.body;

    if (!report_type || !subject_name || !contact_email || !tracking_pin) {
      return sendError(res, 'VALIDATION_ERROR', 'Missing required report fields', 400);
    }

    const userId = req.user ? req.user.user_id : null;
    const report = await reportRepo.createReport(req.body, userId);

    return sendSuccess(res, report, 'Report submitted successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getMyReports = async (req, res, next) => {
  try {
    const reports = await reportRepo.getReportsByUserId(req.user.user_id);
    return sendSuccess(res, reports, 'User reports retrieved');
  } catch (error) {
    next(error);
  }
};

export const trackReport = async (req, res, next) => {
  try {
    const { referenceNo } = req.params;
    const pin = req.query.pin || req.body.pin;

    if (!pin) {
      return sendError(res, 'VALIDATION_ERROR', 'Tracking PIN is required', 400);
    }

    const report = await reportRepo.getReportByRefAndPin(referenceNo, pin);

    if (!report) {
      return sendError(res, 'NOT_FOUND', 'Invalid reference number or tracking PIN', 404);
    }

    return sendSuccess(res, report, 'Report status retrieved');
  } catch (error) {
    next(error);
  }
};