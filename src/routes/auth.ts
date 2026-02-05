import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// SEC-002: Apply rate limiting to auth endpoints
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authRateLimiter, authController.refresh);
router.get('/me', authMiddleware, authController.me);

export default router;
