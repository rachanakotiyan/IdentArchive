import { Router } from 'express';
import { submitReport, getMyReports, trackReport } from '../controllers/reportController.js';
import { authenticate } from '../middleware/authenticate.js';
import { trackLimiter, submitReportLimiter } from '../middleware/rateLimiters.js';
import { casesLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/', authenticate, submitReportLimiter, submitReport);
router.get('/me', authenticate, getMyReports);
// POST so the email is never in the URL / access logs
router.post('/track', trackLimiter, trackReport);

export default router;