import { Router } from 'express'
import {
  getCases,
  getCaseByNumber,
  getCaseUpdates,
} from '../controllers/caseController.js'

const router = Router()

// Public endpoints
router.get('/', getCases)
router.get('/:caseNumber', getCaseByNumber)
router.get('/:caseNumber/updates', getCaseUpdates)

export default router
