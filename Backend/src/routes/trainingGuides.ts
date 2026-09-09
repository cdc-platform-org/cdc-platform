import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { guideChatSchema } from '../schemas/trainingGuideSchemas';
import { answerTrainingGuide, getTrainingGuides, saveGuideProgress } from '../services/trainingGuideService';

const router = Router();
router.use('/:trainingId/guide', authenticate, requireNotBannedOrDeleted);
router.get('/:trainingId/guide', async (req, res) => {
  res.json({ data: await getTrainingGuides(req.params.trainingId, req.user!.id) });
});
router.put('/:trainingId/guide/days/:dayId/progress', async (req, res) => {
  const result = z.object({ itemId: z.string().min(1).max(100), completed: z.boolean() }).safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  await saveGuideProgress(req.params.trainingId, req.user!.id, req.params.dayId, result.data.itemId, result.data.completed);
  res.json({ data: { saved: true } });
});
router.post('/:trainingId/guide/chat', rateLimit({ windowMs: 60 * 1000, max: 15 }), async (req, res) => {
  const result = guideChatSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  res.json({ data: await answerTrainingGuide(req.params.trainingId, req.user!.id, result.data) });
});
export default router;
