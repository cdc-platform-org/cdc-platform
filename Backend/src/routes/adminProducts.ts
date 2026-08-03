import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  // Major-unit GEL from the admin form — converted to minor units (tetri)
  // here so every other money field in the DB (Course.originalPrice,
  // BogPayment.amount) stays in the same unit.
  price: z.number().min(0),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  fileUrl: z.string().url(),
});

router.post('/', async (req: Request, res: Response) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.create({
    data: { ...result.data, price: Math.round(result.data.price * 100) },
  });
  res.status(201).json({ data: product });
});

export default router;
