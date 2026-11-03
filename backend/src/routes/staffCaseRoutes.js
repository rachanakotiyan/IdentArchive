import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import {
  listCases,
  getCaseDetail,
  addUpdate,
  assignCase,
  updateStatus,
  closeCase,
} from '../controllers/staffCaseController.js'

const router = Router()

// All staff case routes require staff authentication
router.use(authenticate, authorize('officer', 'admin'))

router.get('/', listCases)
router.get('/:caseId', getCaseDetail)
router.post('/:caseId/updates', addUpdate)
router.post('/:caseId/assign', assignCase)
router.patch('/:caseId/status', updateStatus)
router.post('/:caseId/close', closeCase)

export default router

