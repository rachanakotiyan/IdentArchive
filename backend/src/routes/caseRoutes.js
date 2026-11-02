import { Router } from 'express'
import {
  getCases,
  getCaseByNumber,
  getCaseUpdates,
} from '../controllers/caseController.js'
import { casesLimiter } from '../middleware/rateLimiters.js'

const router = Router()

// Public endpoints (rate-limited)
router.get('/', casesLimiter, getCases)
router.get('/:caseNumber', casesLimiter, getCaseByNumber)
router.get('/:caseNumber/updates', casesLimiter, getCaseUpdates)

export default router
