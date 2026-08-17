import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { rejectUserSchema, banUserSchema, updateAiTrialSchema } from '../schemas/adminSchemas';
import { sendPasswordResetEmail } from '../services/emailService';
const router = Router();

// Same hash-the-token-not-the-password posture as routes/auth.ts's own
// forgot-password flow (duplicated rather than shared — a small pure
// function, not worth a new module for one line).
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Baseline: any admin-team member can at least read. Mutating routes below
// layer a stricter requireAdminRole() on top where the task calls for it.
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

router.get('/users', async (req: Request, res: Response) => {
  const { status } = req.query;
  const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
  if (status && !validStatuses.includes(String(status))) {
    return res.status(400).json({ message: 'Invalid status filter.' });
  }
  const users = await prisma.user.findMany({
    where: status ? { status: status as 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' } : undefined,
    orderBy: { createdAt: 'desc' },
    omit: { password: true },
  });
  res.json(users);
});

router.post('/users/:id/approve', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.status === 'APPROVED') {
    return res.status(400).json({ message: 'This user is already approved.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', rejectionReason: null },
    omit: { password: true },
  });
  res.json(updated);
});

router.post('/users/:id/reject', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = rejectUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.status === 'REJECTED') {
    return res.status(400).json({ message: 'This user is already rejected.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED', rejectionReason: result.data.reason ?? null },
    omit: { password: true },
  });
  res.json(updated);
});

router.post(
  '/users/:id/verify-graduate',
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.role !== 'Student') {
      return res.status(400).json({ message: 'Only students can be verified as CDC graduates.' });
    }
    if (user.isVerifiedGraduate) {
      return res.status(400).json({ message: 'This user is already a verified graduate.' });
    }
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isVerifiedGraduate: true },
      omit: { password: true },
    });
    res.json(updated);
  }
);

router.post(
  '/users/:id/unverify-graduate',
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isVerifiedGraduate: false },
      omit: { password: true },
    });
    res.json(updated);
  }
);

// Ban/unban: available to all three admin tiers (this is the "Support/Report
// Management" domain MODERATOR is meant to cover), but a non-SUPER_ADMIN
// can't ban a fellow admin-team member — only SUPER_ADMIN can act on staff.
router.post('/users/:id/ban', async (req: Request, res: Response) => {
  const result = banUserSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.id === req.user!.id) {
    return res.status(400).json({ message: 'You cannot ban your own account.' });
  }
  if (user.adminRole && req.adminRole !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Only a SuperAdmin can ban an admin-team member.' });
  }
  if (user.isBanned) {
    return res.status(400).json({ message: 'This user is already banned.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBanned: true, bannedAt: new Date(), banReason: result.data.reason ?? null },
    omit: { password: true },
  });
  res.json(updated);
});

// Support-initiated password reset — an admin can't set or see a user's new
// password directly (same "never handle a real password" posture as
// bcrypt-hashed storage elsewhere), only trigger the same reset-link email
// the user's own "Forgot password?" flow sends (routes/auth.ts's
// POST /forgot-password). Lets support actually help a user locked out of
// their email too, unlike the self-serve flow.
//
// Google-linked accounts are allowed through deliberately: routes/auth.ts's
// POST /reset-password already sets `password` unconditionally (no googleId
// check) and POST /login has no googleId gate either, so completing this
// flow just gives a Google-only account a real, usable password — letting
// them sign in with either method going forward, same as linking normally
// happens on first Google login for an existing email/password account.
router.post('/users/:id/reset-password', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashResetToken(token),
      passwordResetTokenExpires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    },
  });
  sendPasswordResetEmail(user.email, token, 'ka');
  res.json({ message: 'Password reset email sent.' });
});

router.post('/users/:id/unban', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!user.isBanned) {
    return res.status(400).json({ message: 'This user is not banned.' });
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBanned: false, bannedAt: null, banReason: null },
    omit: { password: true },
  });
  res.json(updated);
});

// AI Agents Suite trial management — SuperAdmin-only (stricter than the
// router-wide baseline), Business (Client) accounts only. See
// utils/aiAgentsSuiteAccess.ts for how aiTrialEndsAt/aiSubscriptionActive
// combine to gate actual access.
router.patch('/users/:id/ai-trial', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = updateAiTrialSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, aiTrialEndsAt: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.role !== 'Client') {
    return res.status(400).json({ message: 'The AI Agents Suite trial only applies to Business accounts.' });
  }

  let data: { aiTrialEndsAt?: Date | null; aiSubscriptionActive?: boolean };
  if (result.data.mode === 'extend') {
    const base = Math.max(Date.now(), user.aiTrialEndsAt?.getTime() ?? 0);
    data = { aiTrialEndsAt: new Date(base + result.data.days * 24 * 60 * 60 * 1000) };
  } else if (result.data.mode === 'set') {
    data = { aiTrialEndsAt: new Date(result.data.date) };
  } else {
    data = { aiSubscriptionActive: true };
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, aiTrialEndsAt: true, aiSubscriptionActive: true },
  });
  res.json({ data: updated });
});

export default router;
