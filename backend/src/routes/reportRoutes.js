import { Router } from 'express';
import { submitReport, getMyReports, trackReport } from '../controllers/reportController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.post('/', authenticate, submitReport);
router.get('/me', authenticate, getMyReports);
router.get('/track/:referenceNo', trackReport);

export default router;