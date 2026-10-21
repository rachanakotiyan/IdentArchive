import { Router } from 'express';
import { submitReport, getMyReports, trackReport } from '../controllers/reportController.js';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Public / optional auth for submitting report
router.post('/', optionalAuth, submitReport);

// Authenticated user viewing their own reports
router.get('/me', authenticateToken, getMyReports);

// Public tracking using Reference No + PIN
router.get('/track/:referenceNo', trackReport);

export default router;