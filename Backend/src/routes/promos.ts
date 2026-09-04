import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { findValidPromoCode, computePromoPrice, resolveTargetPrice, PromoCodeError, CouponTargetNotFoundError } from '../services/couponService';

const router = Router();

const validateSchema = z.object({
  code: z.string().trim().min(1).max(40),
  targetType: z.enum(['COURSE', 'LIVE_TRAINING', 'DIGITAL_PRODUCT', 'AI_TOOL']),
  targetId: z.string().trim().min(1),
});

router.post('/validate', authenticate, async (req: Request, res: Response) => {
  const result = validateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { code, targetType, targetId } = result.data;

  try {
    const promo = await findValidPromoCode(code, targetType, targetId);
    const { currentPrice, originalPrice } = await resolveTargetPrice(targetType, targetId);
    const discountedAmount = computePromoPrice(currentPrice, originalPrice, promo);

    res.json({
      data: {
        code: promo.code,
        discountPercent: promo.discountPercent,
        discountAmount: promo.discountAmount,
        originalAmount: currentPrice,
        discountedAmount,
      },
    });
  } catch (err) {
    if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
    if (err instanceof CouponTargetNotFoundError) return res.status(404).json({ message: err.message });
    throw err;
  }
});

export default router;
