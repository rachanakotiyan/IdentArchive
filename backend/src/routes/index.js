import { Router } from 'express';
import authRoutes from './auth.js';
import healthRoutes from './health.js';
import adminRoutes from './admin.js';
import reportRoutes from './reportRoutes.js';
import staffReportRoutes from './staffReportRoutes.js';
import caseRoutes from './caseRoutes.js';
import matchRoutes from './matchRoutes.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use('/auth', authRoutes);
router.use(healthRoutes);
router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);
router.use('/staff/reports', staffReportRoutes);
router.use('/cases', caseRoutes);
router.use('/api/cases', caseRoutes);
router.use('/staff/matches', authenticate, authorize('officer', 'admin'), matchRoutes);
router.use('/api/staff/matches', authenticate, authorize('officer', 'admin'), matchRoutes);

export default router;