import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { authenticate } from '../middleware/authenticate.js'
import * as authController from '../controllers/authController.js'

const router = Router()

/**
 * Rate limit applied only to POST /login.
 * 10 attempts per 15 minutes per IP+email combination.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  // Key on normalized IP (IPv6-safe) + lowercased email body field
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.toLowerCase().trim()
      : ''
    return JSON.stringify([ipKeyGenerator(req.ip), email])
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
  },
})

// Public routes
router.post('/register', authController.register)
router.post('/login', loginLimiter, authController.login)

// Authenticated routes
router.get('/me', authenticate, authController.me)

export default router
