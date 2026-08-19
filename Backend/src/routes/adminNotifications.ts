import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { sendOfficialNotificationEmail } from '../services/emailService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

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
  const { title, message, type, targetUserId, targetRole } = result.data;

  const recipients = targetUserId
    ? await prisma.user.findMany({ where: { id: targetUserId }, select: { id: true, email: true } })
    : await prisma.user.findMany({
        where: targetRole === 'ALL' ? {} : { role: targetRole },
        select: { id: true, email: true },
      });

  if (recipients.length === 0) {
    return res.status(404).json({ message: 'No matching recipients found.' });
  }

  const { count } = await prisma.notification.createMany({
    data: recipients.map((r) => ({ userId: r.id, title, message, type: type ?? 'ADMIN_DIRECT' })),
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

  res.status(201).json({ data: { sentCount: count } });
});

export default router;
