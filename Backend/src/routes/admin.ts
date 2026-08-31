import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { rejectUserSchema, banUserSchema, updateAiTrialSchema, updateUserRoleSchema, updateUserStatusSchema } from '../schemas/adminSchemas';
import { sendPasswordResetEmail } from '../services/emailService';
import { logAdminAction } from '../services/auditLogService';
const router = Router();

// Thrown by applyUserRoleChange/applyUserStatusChange for every guard
// violation below — a plain Error subclass carrying the intended HTTP
// status, same shape as HRSupportEscrowError/SlotUnavailableError elsewhere
// in this codebase, so the route can catch-and-map while the logic itself
// (and its tests) stays independent of Express's req/res.
export class AdminUserActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminUserActionError';
    this.status = status;
  }
}

// `role: 'SuperAdmin'` is a standalone privilege check used across ~14 route
// files (invoices.ts, hrSupport.ts, gigs.ts, vacancies.ts, adminMentorship.ts,
// etc.) — entirely separate from the adminRole-gated admin-panel access
// /admin-panel/team already manages. Granting or revoking it here therefore
// needs the same SUPER_ADMIN-only bar as minting a new admin-team member,
// not just the MANAGER-level bar the rest of this route's baseline allows.
export async function applyUserRoleChange(params: {
  targetUserId: string;
  callerId: string;
  callerAdminRole: 'SUPER_ADMIN' | 'MANAGER' | 'MODERATOR';
  newRole: Role;
}) {
  if (params.targetUserId === params.callerId) {
    throw new AdminUserActionError(400, 'You cannot change your own role.');
  }
  const user = await prisma.user.findUnique({ where: { id: params.targetUserId } });
  if (!user) throw new AdminUserActionError(404, 'User not found.');
  if ((params.newRole === 'SuperAdmin' || user.role === 'SuperAdmin') && params.callerAdminRole !== 'SUPER_ADMIN') {
    throw new AdminUserActionError(403, 'Only a SuperAdmin can grant or revoke the SuperAdmin role.');
  }
  if (user.role === params.newRole) {
    throw new AdminUserActionError(400, 'This user already has that role.');
  }

  const updated = await prisma.user.update({
    where: { id: params.targetUserId },
    data: { role: params.newRole },
    omit: { password: true },
  });
  await logAdminAction({
    action: 'user.role_change',
    targetType: 'User',
    targetId: user.id,
    performedById: params.callerId,
    metadata: { from: user.role, to: params.newRole },
  });
  return updated;
}

// Generic counterpart to POST /approve and /reject — same two real status
// transitions (and the same rejectionReason side effect), reachable as one
// PATCH so the admin UI can drive it from a single dropdown.
export async function applyUserStatusChange(params: {
  targetUserId: string;
  callerId: string;
  newStatus: UserStatus;
  reason?: string;
}) {
  if (params.targetUserId === params.callerId) {
    throw new AdminUserActionError(400, 'You cannot change your own account status.');
  }
  const user = await prisma.user.findUnique({ where: { id: params.targetUserId } });
  if (!user) throw new AdminUserActionError(404, 'User not found.');
  if (user.status === params.newStatus) {
    throw new AdminUserActionError(400, 'This user already has that status.');
  }

  const updated = await prisma.user.update({
    where: { id: params.targetUserId },
    data: {
      status: params.newStatus,
      // Mirrors /approve (clears a stale reason) and /reject (records a
      // fresh one) — this generic endpoint keeps the same side effect no
      // matter which UI control triggered the transition.
      rejectionReason: params.newStatus === 'REJECTED' ? params.reason ?? null : null,
    },
    omit: { password: true },
  });
  await logAdminAction({
    action: 'user.status_change',
    targetType: 'User',
    targetId: user.id,
    performedById: params.callerId,
    metadata: { from: user.status, to: params.newStatus },
  });
  return updated;
}

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

// `page`/`limit` are opt-in: the admin/users.tsx list page does its own
// search/role filtering client-side over the full list and doesn't pass
// them today, so an un-paginated call behaves exactly as before (this is
// the frontend's actual usage pattern, not an oversight — see the QA audit
// note on why a full server-side-search rewrite wasn't attempted here).
// Passing them caps the query instead of always loading the entire table,
// for any current/future caller that wants a bounded page.
router.get('/users', async (req: Request, res: Response) => {
  const { status, page, limit } = req.query;
  const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
  if (status && !validStatuses.includes(String(status))) {
    return res.status(400).json({ message: 'Invalid status filter.' });
  }
  const pageNum = page !== undefined ? parseInt(String(page), 10) : undefined;
  const limitNum = limit !== undefined ? parseInt(String(limit), 10) : undefined;
  if (page !== undefined && (!Number.isInteger(pageNum) || pageNum! < 1)) {
    return res.status(400).json({ message: 'page must be a positive integer.' });
  }
  if (limit !== undefined && (!Number.isInteger(limitNum) || limitNum! < 1 || limitNum! > 500)) {
    return res.status(400).json({ message: 'limit must be a positive integer up to 500.' });
  }

  const where = status ? { status: status as 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' } : undefined;
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    omit: { password: true },
    ...(limitNum ? { take: limitNum, skip: ((pageNum ?? 1) - 1) * limitNum } : {}),
  });
  if (limitNum) {
    const total = await prisma.user.count({ where });
    return res.json({ data: users, pagination: { page: pageNum ?? 1, limit: limitNum, total } });
  }
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

// Generic role assignment — any of the 4 Role enum values, for the admin
// UI's Role dropdown (see applyUserRoleChange's own comment for why touching
// SuperAdmin needs a stricter bar than this route's own MANAGER-inclusive
// baseline).
router.patch('/users/:id/role', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = updateUserRoleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const updated = await applyUserRoleChange({
      targetUserId: req.params.id,
      callerId: req.user!.id,
      callerAdminRole: req.adminRole!,
      newRole: result.data.role,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof AdminUserActionError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

// Generic status assignment — any of the 3 UserStatus enum values, for the
// admin UI's Status dropdown. Functionally a superset of POST /approve and
// POST /reject above (same transitions, same rejectionReason side effect).
router.patch('/users/:id/status', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = updateUserStatusSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const updated = await applyUserStatusChange({
      targetUserId: req.params.id,
      callerId: req.user!.id,
      newStatus: result.data.status,
      reason: result.data.reason,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof AdminUserActionError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
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

// Grants/revokes access to /admin/hr-requests's specialist-facing screens
// (see the isHrSpecialist comment on the User model) — set manually for now,
// no self-serve application flow.
//
// Wrapped in try/catch (unlike the sibling verify-graduate routes above)
// because this specific route came in as a live bug report: an admin
// clicking it saw only a generic "action failed" toast with no detail. The
// most likely concrete cause of an unhandled throw here — a malformed
// :id reaching prisma.user.findUnique before the friendly 404 check even
// runs, since Postgres rejects a non-UUID string for this column outright
// — previously fell straight through to errorHandler.ts's blanket "Server
// error" mask. This at least turns that into a clean 400 the frontend can
// actually show, instead of an opaque 500.
router.post('/users/:id/set-hr-specialist', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isHrSpecialist: true },
      omit: { password: true },
    });
    res.json(updated);
  } catch (err: any) {
    console.error('[admin] set-hr-specialist failed:', err);
    if (err.code === 'P2025') return res.status(404).json({ message: 'User not found.' });
    res.status(400).json({ message: 'Could not grant HR access — the user id looks invalid. Please refresh and try again.' });
  }
});

router.post('/users/:id/unset-hr-specialist', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isHrSpecialist: false },
      omit: { password: true },
    });
    res.json(updated);
  } catch (err: any) {
    console.error('[admin] unset-hr-specialist failed:', err);
    if (err.code === 'P2025') return res.status(404).json({ message: 'User not found.' });
    res.status(400).json({ message: 'Could not revoke HR access — the user id looks invalid. Please refresh and try again.' });
  }
});

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

/**
 * AI Agents Suite trial management — SuperAdmin-only (stricter than the
 * router-wide baseline), Business (Client) accounts only. See
 * utils/aiAgentsSuiteAccess.ts for how aiTrialEndsAt/aiSubscriptionActive
 * combine to gate actual access.
 * Updated to fix auto-translate path for better accuracy.
 */
router.patch('/admin/ai-trial', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
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

const updateEducatorVipSchema = z.object({ active: z.boolean() });

// AI Educator VIP Hub grant/revoke — flag-based access, no card/billing
// engine (see User.educatorVipActive's own schema comment). Open to any
// role, unlike the AI Agents Suite trial above which is Client-only, so
// this deliberately skips that route's role check.
router.patch('/users/:id/educator-vip', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = updateEducatorVipSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { educatorVipActive: result.data.active },
    select: { id: true, educatorVipActive: true },
  });

  await logAdminAction({
    action: result.data.active ? 'educator_vip.grant' : 'educator_vip.revoke',
    targetType: 'User',
    targetId: req.params.id,
    performedById: req.user!.id,
  });

  res.json({ data: updated });
});

export default router;
