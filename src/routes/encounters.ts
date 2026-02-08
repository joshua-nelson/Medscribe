import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  createEncounter,
  getEncounter,
  listEncounters,
  updateEncounter,
} from '../controllers/encounterController';

const router = Router();

router.use(authMiddleware);

router.post('/', createEncounter);
router.get('/', listEncounters);
router.get('/:id', getEncounter);
router.patch('/:id', updateEncounter);

export default router;
