import { Router } from 'express';
import authRoutes from './auth.js';
import healthRoutes from './health.js';
import adminRoutes from './admin.js';
import reportRoutes from './reportRoutes.js';
import staffReportRoutes from './staffReportRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use(healthRoutes);
router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);
router.use('/staff/reports', staffReportRoutes);

export default router;