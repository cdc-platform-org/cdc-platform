import { Router } from 'express';
import { authenticate, optionalAuthenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { learningRatingSchema } from '../schemas/learningRatingSchemas';
import { getLearningRatings, saveLearningRating, LearningRatingTarget } from '../services/learningRatingService';

export function createLearningRatingsRouter(target: LearningRatingTarget) {
  const router = Router();
  router.get('/:id/ratings', optionalAuthenticate, async (req, res) => {
    res.json({ data: await getLearningRatings(target, req.params.id, req.user?.id) });
  });
  router.put('/:id/ratings', authenticate, requireNotBannedOrDeleted,
    rateLimit({ windowMs: 60 * 60 * 1000, max: 60 }), async (req, res) => {
      const result = learningRatingSchema.safeParse(req.body);
      if (!result.success) return res.status(400).json({ errors: result.error.errors });
      res.json({ data: await saveLearningRating(target, req.params.id, req.user!.id, result.data) });
    });
  return router;
}
