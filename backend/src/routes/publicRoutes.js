import { Router } from 'express'
import { getPublicStats } from '../repositories/pincodeRepository.js'
import { sendSuccess } from '../utils/response.js'

const router = Router()

/**
 * GET /api/public/stats
 * Returns aggregate statistics computed from MySQL. Contains no personal data.
 *
 * Response: { activeCases, underReview, resolvedCases, reportsThisWeek }
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getPublicStats()
    return sendSuccess(res, stats)
  } catch (error) {
    return next(error)
  }
})

export default router
