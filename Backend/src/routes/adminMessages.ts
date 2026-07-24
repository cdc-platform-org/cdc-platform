import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';

const router = Router();
// Chat audit — MODERATOR tier and up, matching "User chat/report
// moderation" in the RBAC hierarchy.
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

const userSelect = { select: { id: true, name: true, email: true } };

// One row per unique (sender, recipient) pair with at least one message —
// unordered by participant, so a thread only appears once regardless of
// who sent the most recent message.
router.get('/threads', async (req: Request, res: Response) => {
  const onlyFlagged = req.query.flagged === 'true';

  const messages = await prisma.message.findMany({
    where: onlyFlagged ? { wasFiltered: true } : undefined,
    include: { sender: userSelect, recipient: userSelect },
    orderBy: { createdAt: 'desc' },
  });

  const threadsByKey = new Map<
    string,
    { participantA: typeof messages[number]['sender']; participantB: typeof messages[number]['sender']; lastMessageAt: Date; messageCount: number; flaggedCount: number }
  >();

  for (const message of messages) {
    const key = [message.senderId, message.recipientId].sort().join(':');
    const existing = threadsByKey.get(key);
    if (existing) {
      existing.messageCount += 1;
      if (message.wasFiltered) existing.flaggedCount += 1;
      if (message.createdAt > existing.lastMessageAt) existing.lastMessageAt = message.createdAt;
    } else {
      threadsByKey.set(key, {
        participantA: message.sender,
        participantB: message.recipient,
        lastMessageAt: message.createdAt,
        messageCount: 1,
        flaggedCount: message.wasFiltered ? 1 : 0,
      });
    }
  }

  const threads = Array.from(threadsByKey.entries())
    .map(([key, t]) => ({ key, ...t }))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

  res.json({ data: threads });
});

router.get('/threads/:userIdA/:userIdB', async (req: Request, res: Response) => {
  const { userIdA, userIdB } = req.params;
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userIdA, recipientId: userIdB },
        { senderId: userIdB, recipientId: userIdA },
      ],
    },
    include: { sender: userSelect, recipient: userSelect },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: messages });
});

export default router;
