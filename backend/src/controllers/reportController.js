import * as reportRepo from '../repositories/reportRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

export const submitReport = async (req, res, next) => {
  try {
    const { report_type, subject_name, contact_email, tracking_pin } = req.body || {}

    if (!report_type || !subject_name || !contact_email || !tracking_pin) {
      throw new AppError('Missing required report fields', 400, 'VALIDATION_ERROR')
    }

    const userId = req.user ? req.user.userId : null;
    const report = await reportRepo.createReport(req.body, userId);

    return sendSuccess(res, report, 201, 'Report submitted successfully')
  } catch (error) {
    return next(error)
  }
};

export const getMyReports = async (req, res, next) => {
  try {
    const reports = await reportRepo.getReportsByUserId(req.user.userId);
    return sendSuccess(res, reports, 200, 'User reports retrieved')
  } catch (error) {
    return next(error)
  }
};

export const trackReport = async (req, res, next) => {
  try {
    const { referenceNo } = req.params;
    const pin = req.query.pin || req.body?.pin

    if (!pin) {
      throw new AppError('Tracking PIN is required', 400, 'VALIDATION_ERROR')
    }

    const report = await reportRepo.getReportByRefAndPin(referenceNo, pin);

    if (!report) {
      throw new AppError('Invalid reference number or tracking PIN', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, report, 200, 'Report status retrieved')
  } catch (error) {
    return next(error)
  }
};