import { Router } from 'express'
import { getPincodeInfo } from '../repositories/pincodeRepository.js'
import { sendSuccess } from '../utils/response.js'
import { AppError } from '../utils/errors.js'
import { pincodesLimiter } from '../middleware/rateLimiters.js'

const router = Router()

/**
 * GET /api/pincodes/:pincode
 * Returns { pincode, city, district, state } for a valid 6-digit Indian pincode.
 * - 400 if the format is not exactly 6 digits
 * - 404 if the pincode is not found in the pincodes table
 */
router.get('/:pincode', pincodesLimiter, async (req, res, next) => {
  try {
    const { pincode } = req.params
    if (!/^\d{6}$/.test(String(pincode ?? ''))) {
      throw new AppError('Pincode must be exactly 6 digits.', 400, 'VALIDATION_ERROR')
    }

    const row = await getPincodeInfo(pincode)
    if (!row) {
      throw new AppError('Pincode not found.', 404, 'NOT_FOUND')
    }

    return sendSuccess(res, {
      pincode: row.pincode,
      city: row.city,
      district: row.district,
      state: row.state,
    })
  } catch (error) {
    return next(error)
  }
})

export default router
