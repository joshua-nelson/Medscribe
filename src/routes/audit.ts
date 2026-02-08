import { Router } from 'express';
import * as auditController from '../controllers/auditController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.get('/logs', authMiddleware, auditController.getAuditLogs);

export default router;
