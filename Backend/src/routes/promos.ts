import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { getCurrentPrice, computeDiscount } from '../services/coursePricing';

const router = Router();

const validateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  courseId: z.string().uuid(),
});

router.post('/validate', authenticate, async (req: Request, res: Response) => {
  const result = validateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const promo = await prisma.promoCode.findUnique({ where: { code: result.data.code.trim().toUpperCase() } });
  if (!promo) return res.status(404).json({ message: 'Invalid promo code.' });
  if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ message: 'This promo code has expired.' });
  if (promo.maxUses && promo.currentUses >= promo.maxUses) return res.status(400).json({ message: 'This promo code has reached its usage limit.' });

  const course = await prisma.course.findUnique({ where: { id: result.data.courseId } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });

  const originalAmount = getCurrentPrice(course);
  const discountedAmount = computeDiscount(promo, originalAmount);

  res.json({
    data: {
      code: promo.code,
      discountPercent: promo.discountPercent,
      discountAmount: promo.discountAmount,
      originalAmount,
      discountedAmount,
    },
  });
});

export default router;
