import * as reportRepo from '../repositories/reportRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

export const submitReport = async (req, res, next) => {
  try {
    const report = await reportRepo.createReport(req.body || {}, req.user.userId)
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
    const { referenceNo } = req.params
    const email = req.query.email || req.body?.email
    if (typeof email !== 'string' || !email.trim()) {
      throw new AppError('Email is required to track a report.', 400, 'VALIDATION_ERROR')
    }

    const report = await reportRepo.getReportByRefAndEmail(referenceNo, email)
    if (!report) {
      throw new AppError('Invalid reference number or email.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, report, 200, 'Report status retrieved')
  } catch (error) {
    return next(error)
  }
};