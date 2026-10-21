import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  getQueue,
  assignReport,
  requestInfo,
  rejectReport,
  approveReport
} from '../controllers/staffReportController.js';

const router = Router();

// Secure all staff report routes for officers and admins
router.use(authenticate, authorize('officer', 'admin'));

router.get('/', getQueue);
router.post('/:reportId/assign', assignReport);
router.post('/:reportId/info-request', requestInfo);
router.post('/:reportId/reject', rejectReport);
router.post('/:reportId/approve', approveReport);

export default router;