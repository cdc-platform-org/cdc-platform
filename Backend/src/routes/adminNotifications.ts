import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { sendOfficialNotificationEmail } from '../services/emailService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

const TARGET_ROLE_LABEL: Record<string, string> = {
  ALL: 'All Users',
  Student: 'Students / Freelancers',
  Client: 'Employers',
};

// Resolves the actual recipient list for a send, plus the human-readable
// label stored on the batch for the history table — shared by POST / and
// POST /:batchId/resend so the two can never compute this differently.
async function resolveRecipients(targetUserId: string | undefined, targetRole: string | undefined) {
  if (targetUserId) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, email: true } });
    return { recipients: user ? [user] : [], targetLabel: user?.email ?? 'Unknown user' };
  }
  const recipients = await prisma.user.findMany({
    where: targetRole === 'ALL' ? {} : { role: targetRole as 'Student' | 'Client' },
    select: { id: true, email: true },
  });
  return { recipients, targetLabel: TARGET_ROLE_LABEL[targetRole ?? 'ALL'] ?? targetRole ?? 'All Users' };
}

// Creates the NotificationBatch + fanned-out Notification rows + best-effort
// emails — the actual send logic shared by POST / (a fresh compose) and
// POST /:batchId/resend (same title/message/target, re-sent).
async function sendBatch(params: {
  title: string;
  message: string;
  type?: string;
  targetUserId?: string;
  targetRole?: string;
  sentById: string;
}): Promise<{ sentCount: number } | { notFound: true }> {
  const { recipients, targetLabel } = await resolveRecipients(params.targetUserId, params.targetRole);
  if (recipients.length === 0) return { notFound: true };

  const batch = await prisma.notificationBatch.create({
    data: {
      title: params.title,
      message: params.message,
      type: params.type ?? 'ADMIN_DIRECT',
      targetUserId: params.targetUserId ?? null,
      targetRole: params.targetRole ?? null,
      targetLabel,
      recipientCount: recipients.length,
      sentById: params.sentById,
    },
  });

  await prisma.notification.createMany({
    data: recipients.map((r) => ({ userId: r.id, title: params.title, message: params.message, type: params.type ?? 'ADMIN_DIRECT', batchId: batch.id })),
  });

  // Best-effort, fire-and-forget per recipient — a broadcast to hundreds of
  // students must never wait on hundreds of Resend calls before responding,
  // and one failed send must never affect the others or the in-app
  // notifications already committed above.
  for (const r of recipients) {
    sendOfficialNotificationEmail(r.email).catch((err) =>
      console.error(`[adminNotifications] sendOfficialNotificationEmail failed for ${r.email}:`, err instanceof Error ? err.message : err)
    );
  }

  return { sentCount: recipients.length };
}

const sendSchema = z
  .object({
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(2000),
    type: z.string().max(50).optional(),
    // Exactly one of these — a specific user, or a role-based broadcast.
    targetUserId: z.string().uuid().optional(),
    targetRole: z.enum(['ALL', 'Student', 'Client']).optional(),
  })
  .refine((data) => !!data.targetUserId !== !!data.targetRole, {
    message: 'Provide exactly one of targetUserId or targetRole.',
  });

router.post('/', async (req: Request, res: Response) => {
  const result = sendSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const outcome = await sendBatch({ ...result.data, sentById: req.user!.id });
  if ('notFound' in outcome) return res.status(404).json({ message: 'No matching recipients found.' });
  res.status(201).json({ data: { sentCount: outcome.sentCount } });
});

// ============================================================
// HISTORY — the "Sent Notifications" table on /admin/notifications. Only
// ever lists batches (admin broadcasts via POST / above) — automated
// notification.create calls elsewhere in the codebase (product moderation,
// KYC, live training leads, etc.) have no batch and never appear here.
// ============================================================

router.get('/', async (_req: Request, res: Response) => {
  const batches = await prisma.notificationBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      sentBy: { select: { name: true, email: true } },
      _count: { select: { notifications: { where: { isRead: true } } } },
      // For a single-recipient batch, the exact read status/timestamp is
      // more useful than a "1/1" ratio — fetched directly rather than
      // making the frontend guess which of the (at most one) notifications
      // to look at.
      notifications: {
        take: 1,
        select: { isRead: true, readAt: true },
      },
    },
  });

  res.json({
    data: batches.map((b) => ({
      id: b.id,
      title: b.title,
      message: b.message,
      type: b.type,
      targetLabel: b.targetLabel,
      recipientCount: b.recipientCount,
      readCount: b._count.notifications,
      sentByName: b.sentBy.name,
      sentByEmail: b.sentBy.email,
      createdAt: b.createdAt,
      // Only meaningful (and only ever populated) when recipientCount === 1.
      singleRecipientRead: b.recipientCount === 1 ? b.notifications[0]?.isRead ?? false : null,
      singleRecipientReadAt: b.recipientCount === 1 ? b.notifications[0]?.readAt ?? null : null,
    })),
  });
});

router.delete('/:batchId', async (req: Request, res: Response) => {
  try {
    // Cascades to every fanned-out Notification row (see the schema's own
    // onDelete: Cascade) — removes this from every recipient's bell/hub,
    // not just the admin's own history view.
    await prisma.notificationBatch.delete({ where: { id: req.params.batchId } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Notification not found.' });
    throw err;
  }
});

router.post('/:batchId/resend', async (req: Request, res: Response) => {
  const original = await prisma.notificationBatch.findUnique({ where: { id: req.params.batchId } });
  if (!original) return res.status(404).json({ message: 'Notification not found.' });

  const outcome = await sendBatch({
    title: original.title,
    message: original.message,
    type: original.type,
    targetUserId: original.targetUserId ?? undefined,
    targetRole: original.targetRole ?? undefined,
    sentById: req.user!.id,
  });
  if ('notFound' in outcome) return res.status(404).json({ message: 'No matching recipients found — the original target may no longer exist.' });
  res.status(201).json({ data: { sentCount: outcome.sentCount } });
});

export default router;
