import rateLimit from 'express-rate-limit'
import { AppError } from '../utils/errors.js'

const isTest = process.env.NODE_ENV === 'test'

/**
 * Build a rate-limit middleware using express-rate-limit.
 *
 * In NODE_ENV=test the `max` is replaced with 1 000 000 so normal tests
 * never trip the limiter.  Pass `{ forceInTest: true }` to opt-in to the
 * real limit inside a test that specifically exercises rate-limiting.
 *
 * @param {import('express-rate-limit').Options & { forceInTest?: boolean }} options
 */
export function makeRateLimiter(options) {
  const { forceInTest = false, ...rest } = options
  const effectiveMax = (isTest && !forceInTest) ? 1_000_000 : rest.max

  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please try again later.',
      },
    },
    handler: (req, res, next, opts) => {
      const err = new AppError(
        opts.message?.error?.message ?? 'Too many requests. Please try again later.',
        429,
        'TOO_MANY_REQUESTS'
      )
      next(err)
    },
    ...rest,
    max: effectiveMax,
  })
}

// ---------------------------------------------------------------------------
// Named limiters
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register – 5 per hour per IP.
 */
export const registerLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many registration attempts. Please try again in an hour.',
    },
  },
})

/**
 * POST /api/reports/track – 10 per 15 min per IP.
 */
export const trackLimiter = makeRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many tracking requests. Please try again shortly.',
    },
  },
})

/**
 * POST /api/reports – 10 per hour per authenticated user.
 * Key on userId so the limit is per-user, not per-IP.
 */
export const submitReportLimiter = makeRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user?.userId ?? req.ip,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many report submissions. Please try again in an hour.',
    },
  },
})

/**
 * GET /api/cases – 120 per minute per IP (generous public read limit).
 */
export const casesLimiter = makeRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.',
    },
  },
})

/**
 * GET /api/pincodes – 120 per minute per IP (generous public read limit).
 */
export const pincodesLimiter = makeRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.',
    },
  },
})
