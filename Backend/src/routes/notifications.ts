import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Header bell dropdown — most recent first, capped so the dropdown stays
// scannable rather than becoming a full inbox.
router.get('/', async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
  res.json({ data: { notifications, unreadCount } });
});

router.post('/:id/read', async (req: Request, res: Response) => {
  const notification = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  const updated = await prisma.notification.update({ where: { id: notification.id }, data: { isRead: true } });
  res.json({ data: updated });
});

export default router;
