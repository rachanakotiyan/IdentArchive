import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import * as authController from '../controllers/authController.js'

const router = Router()

// All admin routes require a valid JWT + admin role
router.use(authenticate, authorize('admin'))

router.post('/staff', authController.createStaff)
router.get('/staff', authController.listStaff)
router.patch('/staff/:id/active', authController.setOfficerActive)

export default router
