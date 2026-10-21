import { Router } from 'express';
import { submitReport, getMyReports, trackReport } from '../controllers/reportController.js';
import { authenticate } from '../middleware/authenticate.js';

// Helper for guest/optional authentication:
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authenticate(req, res, next);
};

const router = Router();

// Submit report (guest or logged-in)
router.post('/', optionalAuth, submitReport);
router.get('/me', authenticate, getMyReports);
router.get('/track/:referenceNo', trackReport);

export default router;