import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  asrHealth,
  bulkReassignTranscriptSpeaker,
  createTranscription,
  patchTranscriptSegmentSpeaker,
} from '../controllers/transcriptionController';

const router = Router();

router.get('/health', asrHealth);
router.post('/', authMiddleware, createTranscription);
router.patch('/:id/segments/:segmentIndex', authMiddleware, patchTranscriptSegmentSpeaker);
router.patch('/:id/speakers/reassign', authMiddleware, bulkReassignTranscriptSpeaker);

export default router;
