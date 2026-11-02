import { z } from 'zod'
import * as reportRepo from '../repositories/reportRepository.js'
import { derivePincodeLocation } from '../repositories/pincodeRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const REPORT_TYPES = ['missing', 'found']
const GENDERS = ['male', 'female', 'other', 'unknown']

/** Strict schema for POST /api/reports */
export const submitReportSchema = z.object({
  report_type: z.enum(REPORT_TYPES),
  person_name: z.string().min(1).max(255).optional(),
  gender: z.enum(GENDERS),
  age: z.number().int().min(0).max(130).optional(),
  height_cm: z.number().int().min(20).max(300).optional(),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'event_date must be YYYY-MM-DD')
    .refine((d) => {
      const dt = new Date(d)
      if (Number.isNaN(dt.getTime())) return false
      return dt.getTime() <= Date.now()
    }, 'event_date must be a valid date and not in the future'),
  description: z.string().min(10).max(5000),
  physical_features: z.string().max(1000).optional(),
  identifying_marks: z.string().max(1000).optional(),
  location_address: z.string().min(1).max(500),
  location_pincode: z.string().regex(/^\d{6}$/, 'location_pincode must be 6 digits'),
  // city/district/state are derived from pincodes table; client values are ignored
})

/** Schema for POST /api/reports/track */
const trackSchema = z.object({
  reference_no: z.string().min(1, 'reference_no is required'),
  email: z.string().email('email must be a valid email address'),
})

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

export const submitReport = async (req, res, next) => {
  try {
    const parsed = submitReportSchema.safeParse(req.body || {})
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }))
      throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', details)
    }

    const data = parsed.data

    // Derive city/district/state from the pincodes table (never trust client values)
    const location = await derivePincodeLocation(data.location_pincode)

    const reportData = {
      ...data,
      location_city: location.city,
      location_district: location.district,
      location_state: location.state,
    }

    const report = await reportRepo.createReport(reportData, req.user.userId)
    return sendSuccess(res, report, 201, 'Report submitted successfully')
  } catch (error) {
    return next(error)
  }
}

export const getMyReports = async (req, res, next) => {
  try {
    const reports = await reportRepo.getReportsByUserId(req.user.userId)
    return sendSuccess(res, reports, 200, 'User reports retrieved')
  } catch (error) {
    return next(error)
  }
}

export const trackReport = async (req, res, next) => {
  try {
    // Validate body: { reference_no, email }
    const parsed = trackSchema.safeParse(req.body || {})
    if (!parsed.success) {
      // Generic error: don't hint whether the ref or email is wrong
      throw new AppError('Invalid reference number or email.', 404, 'NOT_FOUND')
    }

    const { reference_no, email } = parsed.data
    const result = await reportRepo.getReportByRefAndEmail(reference_no, email)
    if (!result) {
      throw new AppError('Invalid reference number or email.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, result, 200, 'Report status retrieved')
  } catch (error) {
    return next(error)
  }
}