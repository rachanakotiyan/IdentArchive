import * as matchRepo from '../repositories/matchRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'

/**
 * GET /api/staff/matches
 * Retrieves the paginated queue of matches awaiting or undergoing review.
 * Filterable by status (pending, confirmed, dismissed).
 */
export const getMatchesQueue = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, pageSize } = req.query

    const safePage = Math.max(1, Math.trunc(Number(page) || 1))
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(Number(limit ?? pageSize) || 20)))

    const matches = await matchRepo.getMatchesQueue({
      status,
      page: safePage,
      limit: safeLimit,
    })

    const meta = {
      page: safePage,
      limit: safeLimit,
      count: matches.length,
    }

    return sendSuccess(res, matches, 200, 'Matches retrieved successfully', meta)
  } catch (error) {
    return next(error)
  }
}

/**
 * GET /api/staff/matches/:matchId
 * Retrieves detailed information for a single match pair along with
 * case summaries for both sides and the latest officer verification audit if present.
 */
export const getMatchById = async (req, res, next) => {
  try {
    const { matchId } = req.params

    if (!matchId || !String(matchId).trim()) {
      throw new AppError('Match ID is required.', 400, 'VALIDATION_ERROR')
    }

    const match = await matchRepo.getMatchById(String(matchId).trim())

    if (!match) {
      throw new AppError('Match not found.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, match, 200, 'Match retrieved successfully')
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/staff/matches/:matchId/verify
 * Records an officer's verification decision ('confirmed' or 'dismissed')
 * and updates the match status atomically.
 */
export const verifyMatch = async (req, res, next) => {
  try {
    const { matchId } = req.params
    const { action, decision, notes, remarks } = req.body || {}

    if (!matchId || !String(matchId).trim()) {
      throw new AppError('Match ID is required.', 400, 'VALIDATION_ERROR')
    }

    const effectiveAction = action ?? decision
    if (!effectiveAction || typeof effectiveAction !== 'string' || !effectiveAction.trim()) {
      throw new AppError(
        'Verification action is required ("confirmed" or "dismissed").',
        400,
        'VALIDATION_ERROR'
      )
    }

    const effectiveNotes = notes ?? remarks
    if (
      effectiveNotes === undefined ||
      effectiveNotes === null ||
      typeof effectiveNotes !== 'string' ||
      !effectiveNotes.trim()
    ) {
      throw new AppError(
        'Verification notes/remarks are required.',
        400,
        'VALIDATION_ERROR'
      )
    }

    const officerUserId = req.user?.userId
    if (!officerUserId) {
      throw new AppError('Authenticated officer user ID is required.', 401, 'UNAUTHORIZED')
    }

    const updatedMatch = await matchRepo.verifyMatch(
      String(matchId).trim(),
      officerUserId,
      effectiveAction.trim(),
      effectiveNotes.trim()
    )

    return sendSuccess(res, updatedMatch, 200, 'Match verified successfully')
  } catch (error) {
    return next(error)
  }
}

// Aliases for convenience
export const getQueue = getMatchesQueue
export const getMatch = getMatchById
export const verify = verifyMatch
