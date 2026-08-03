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

// Admin-authored products skip moderation — there's no point an admin
// approving their own submission — unlike products.ts's graduate-facing
// POST /, which always lands PENDING.
router.post('/', async (req: Request, res: Response) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.create({
    data: { ...result.data, price: Math.round(result.data.price * 100), status: 'APPROVED' },
  });
  res.status(201).json({ data: product });
});

// Full list across every status — the public GET /api/products only ever
// shows APPROVED, so the moderation queue needs its own view.
router.get('/', async (_req: Request, res: Response) => {
  const products = await prisma.digitalProduct.findMany({
    orderBy: { createdAt: 'desc' },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });
  res.json({ data: products });
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const updated = await prisma.digitalProduct.update({
    where: { id: product.id },
    data: { status: 'APPROVED', rejectionReason: null },
  });

  if (product.submittedById) {
    await prisma.notification.create({
      data: {
        userId: product.submittedById,
        title: 'თქვენი პროდუქტი დამტკიცდა',
        message: `„${product.title}" გამოქვეყნდა ციფრულ მაღაზიაში.`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.json({ data: updated });
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const result = rejectSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const updated = await prisma.digitalProduct.update({
    where: { id: product.id },
    data: { status: 'REJECTED', rejectionReason: result.data.reason },
  });

  if (product.submittedById) {
    await prisma.notification.create({
      data: {
        userId: product.submittedById,
        title: 'თქვენი პროდუქტი უარყოფილია',
        message: `„${product.title}": ${result.data.reason}`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.json({ data: updated });
});

export default router;
