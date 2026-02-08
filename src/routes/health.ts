import { Router } from 'express';
import { getCsrfToken } from '../middleware/csrfProtection';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// SEC-016: Endpoint to get CSRF token
router.get('/csrf-token', getCsrfToken);

export default router;
