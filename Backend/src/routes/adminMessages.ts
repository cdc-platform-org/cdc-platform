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

  // Lean select (IDs + the 2 fields the aggregation actually needs) instead
  // of the previous `include: { sender: userSelect, recipient: userSelect }`
  // — that joined and serialized two full user objects on EVERY message row
  // platform-wide just to build the thread map, when only messageCount/
  // flaggedCount/lastMessageAt genuinely need every row; participant names
  // are only needed once per THREAD, fetched separately below for just the
  // threads actually returned.
  const messages = await prisma.message.findMany({
    where: onlyFlagged ? { wasFiltered: true } : undefined,
    select: { senderId: true, recipientId: true, createdAt: true, wasFiltered: true },
    orderBy: { createdAt: 'desc' },
  });

  const threadsByKey = new Map<
    string,
    { participantAId: string; participantBId: string; lastMessageAt: Date; messageCount: number; flaggedCount: number }
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
        participantAId: message.senderId,
        participantBId: message.recipientId,
        lastMessageAt: message.createdAt,
        messageCount: 1,
        flaggedCount: message.wasFiltered ? 1 : 0,
      });
    }
  }

  // Aggregation above still scans every message (correctness — an old
  // thread's true messageCount/flaggedCount can't be computed from only the
  // newest N rows), but the OUTPUT is capped to the 200 most recently
  // active threads — an admin moderation view has no use for threads that
  // haven't seen activity in ages, and this bounds the response payload.
  const threads = Array.from(threadsByKey.entries())
    .map(([key, t]) => ({ key, ...t }))
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .slice(0, 200);

  const participantIds = Array.from(new Set(threads.flatMap((t) => [t.participantAId, t.participantBId])));
  const participants = await prisma.user.findMany({ where: { id: { in: participantIds } }, ...userSelect });
  const participantById = new Map(participants.map((p) => [p.id, p]));

  const threadsWithParticipants = threads.map(({ participantAId, participantBId, ...rest }) => ({
    ...rest,
    participantA: participantById.get(participantAId) ?? null,
    participantB: participantById.get(participantBId) ?? null,
  }));

  res.json({ data: threadsWithParticipants });
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
