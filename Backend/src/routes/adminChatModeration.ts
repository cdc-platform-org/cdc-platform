import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
// Same tier as adminMessages.ts's "chat audit" — MODERATOR and up.
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

const userSelect = { select: { id: true, name: true, email: true, isBanned: true } };

// Newest first, unreviewed surfaced by the Frontend's own filter (not
// server-side — the full list is small enough that a client-side toggle is
// simpler than a second query shape). Actually banning the offender is a
// separate action — see routes/admin.ts's existing POST /users/:id/ban,
// reused as-is rather than duplicated here.
router.get('/', async (req: Request, res: Response) => {
  const onlyUnreviewed = req.query.unreviewed === 'true';
  const flags = await prisma.chatFlag.findMany({
    where: onlyUnreviewed ? { reviewedAt: null } : undefined,
    include: { sender: userSelect, recipient: userSelect, reviewedByAdmin: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ data: flags });
});

router.post('/:id/review', async (req: Request, res: Response) => {
  const flag = await prisma.chatFlag.findUnique({ where: { id: req.params.id } });
  if (!flag) return res.status(404).json({ message: 'Incident not found.' });

  const updated = await prisma.chatFlag.update({
    where: { id: flag.id },
    data: { reviewedAt: new Date(), reviewedByAdminId: req.user!.id },
    include: { sender: userSelect, recipient: userSelect, reviewedByAdmin: { select: { id: true, name: true } } },
  });
  await logAdminAction({ action: 'chat-moderation.review', targetType: 'ChatFlag', targetId: flag.id, performedById: req.user!.id });
  res.json({ data: updated });
});

export default router;
