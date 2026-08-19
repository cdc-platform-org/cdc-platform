import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { recomputeProductReviewAggregates } from '../services/productReviewAggregateService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Full moderation queue — every Digital Store product review, newest first.
router.get('/', async (_req: Request, res: Response) => {
  const reviews = await prisma.productReview.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, title: true, submittedById: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: reviews });
});

// Hard delete — an inappropriate review has no legitimate reason to stay
// visible in any form, unlike DigitalProduct moderation (which keeps
// REJECTED rows around for the submitter to see why). Recomputes the
// product's and seller's rating rollups afterward so removing a review
// can't leave a stale average behind.
router.delete('/:id', async (req: Request, res: Response) => {
  const review = await prisma.productReview.findUnique({ where: { id: req.params.id }, select: { id: true, productId: true } });
  if (!review) return res.status(404).json({ message: 'Review not found.' });

  await prisma.$transaction(async (tx) => {
    await tx.productReview.delete({ where: { id: review.id } });
    await recomputeProductReviewAggregates(tx, review.productId);
  });

  res.status(204).send();
});

export default router;
