import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';
import { authRateLimiter, refreshRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to auth endpoints (prevents brute force)
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', refreshRateLimiter, authController.refresh);
router.get('/me', authMiddleware, authController.me);

export default router;
