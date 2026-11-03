import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { getDashboard } from '../controllers/staffDashboardController.js'

const router = Router()

router.use(authenticate, authorize('officer', 'admin'))

router.get('/', getDashboard)

export default router

