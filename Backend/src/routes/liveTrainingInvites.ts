import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { redeemInvite, LiveTrainingInviteError } from '../services/liveTrainingInviteService';

const router = Router();

router.post('/:token/redeem', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const result = z.object({ locale: z.string().max(10).optional() }).safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true, email: true, phone: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  try {
    const data = await redeemInvite(req.params.token, { id: req.user!.id, email: user.email, name: user.name, phone: user.phone }, result.data.locale);
    res.json({ data });
  } catch (err) {
    if (err instanceof LiveTrainingInviteError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
