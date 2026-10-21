import * as caseRepo from '../repositories/caseRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

/**
 * GET /api/cases
 * Public endpoint to list and search cases with filters and pagination.
 */
export const getCases = async (req, res, next) => {
  try {
    const {
      case_type,
      caseType,
      pincode,
      district,
      state,
      gender,
      age_min,
      age_max,
      minAge,
      maxAge,
      query,
      q,
      case_status,
      caseStatus,
      status,
      page,
      limit,
      pageSize,
    } = req.query

    const cases = await caseRepo.searchCases({
      case_type: case_type ?? caseType,
      pincode,
      district,
      state,
      gender,
      age_min: age_min ?? minAge,
      age_max: age_max ?? maxAge,
      query: query ?? q,
      case_status: case_status ?? caseStatus ?? status,
      page,
      limit: limit ?? pageSize,
    })

    const meta = {
      total: cases.total ?? cases.length,
      page: cases.page ?? Math.max(1, Math.trunc(Number(page) || 1)),
      limit: cases.limit ?? Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20))),
      totalPages: cases.totalPages ?? 1,
    }

    return sendSuccess(res, cases, 200, 'Cases retrieved successfully', meta)
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/cases/:caseNumber
 * Public endpoint to retrieve case details by case number (or case ID).
 */
export const getCaseByNumber = async (req, res, next) => {
  try {
    const { caseNumber } = req.params
    if (!caseNumber || !String(caseNumber).trim()) {
      throw new AppError('Case number is required', 400, 'VALIDATION_ERROR')
    }

    const caseItem = await caseRepo.getCaseByNumber(caseNumber)
    if (!caseItem) {
      throw new AppError('Case not found', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, caseItem, 200, 'Case details retrieved successfully')
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/cases/:caseNumber/updates
 * Public endpoint to retrieve milestones/updates for a specific case.
 */
export const getCaseUpdates = async (req, res, next) => {
  try {
    const { caseNumber } = req.params
    if (!caseNumber || !String(caseNumber).trim()) {
      throw new AppError('Case number is required', 400, 'VALIDATION_ERROR')
    }

    // Verify case existence first to return 404 if case does not exist
    const caseItem = await caseRepo.getCaseByNumber(caseNumber)
    if (!caseItem) {
      throw new AppError('Case not found', 404, 'NOT_FOUND')
    }

    const updates = await caseRepo.getCaseUpdates(caseNumber)
    return sendSuccess(res, updates, 200, 'Case updates retrieved successfully')
  } catch (error) {
    return next(error)
  }
}

export const searchCases = getCases
export const listCases = getCases
export const getCaseByCaseNumber = getCaseByNumber
export const getCaseUpdatesByCaseNumber = getCaseUpdates
