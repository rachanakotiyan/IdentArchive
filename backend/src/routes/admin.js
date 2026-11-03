import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import * as authController from '../controllers/authController.js'
import * as adminController from '../controllers/adminController.js'

const router = Router()

// All admin routes require a valid JWT + admin role
router.use(authenticate, authorize('admin'))

// Milestone 4 staff management routes
router.post('/staff', authController.createStaff)
router.get('/staff', authController.listStaff)
router.patch('/staff/:id/active', authController.setOfficerActive)

// Admin management endpoints
router.get('/officers', adminController.listOfficers)
router.get('/users', adminController.listUsers)

export default router
