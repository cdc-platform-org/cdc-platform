import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { createPromoCodeSchema, updatePromoCodeSchema } from '../schemas/promoCodeSchemas';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: codes });
});

router.post('/', async (req: Request, res: Response) => {
  const result = createPromoCodeSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { expiresAt, ...rest } = result.data;
  try {
    const code = await prisma.promoCode.create({
      data: { ...rest, expiresAt: expiresAt ? new Date(expiresAt) : null },
    });
    await logAdminAction({ action: 'promo.create', targetType: 'PromoCode', targetId: code.id, performedById: req.user!.id });
    res.status(201).json({ data: code });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'A promo code with this code already exists.' });
    throw err;
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = updatePromoCodeSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { expiresAt, ...rest } = result.data;
  const code = await prisma.promoCode
    .update({
      where: { id: req.params.id },
      data: { ...rest, ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }) },
    })
    .catch(() => null);
  if (!code) return res.status(404).json({ message: 'Promo code not found.' });

  await logAdminAction({ action: 'promo.update', targetType: 'PromoCode', targetId: code.id, performedById: req.user!.id });
  res.json({ data: code });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const code = await prisma.promoCode.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!code) return res.status(404).json({ message: 'Promo code not found.' });

  await logAdminAction({ action: 'promo.delete', targetType: 'PromoCode', targetId: code.id, performedById: req.user!.id });
  res.status(204).send();
});

export default router;
