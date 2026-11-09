import { prisma } from '../lib/prisma';
import crypto from 'crypto';

// ============================================================
// AI Educator VIP Hub lifecycle — the cardless 5-day trial and the
// per-login session-id rotation the single-active-session lock depends on.
// Deliberately NOT the BillingSubscription engine (see
// User.educatorVipActive's own schema comment) — post-trial access is
// admin-granted (routes/admin.ts's PATCH /users/:id/educator-vip), same
// reasoning/shape as aiSubscriptionActive's own admin-only grant.
// ============================================================

export const EDUCATOR_TRIAL_DAYS = 5;
export const EDUCATOR_VIP_PRICE_GEL = 5000; // 50.00 GEL, minor units (tetri)
export const EDUCATOR_VIP_PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Fulfillment for a confirmed EDUCATOR_VIP payment (BOG callback in
// routes/payments.ts). Extends from the later of now or the current paid
// period, so an early renewal never loses days. No recurring charge: access
// simply lapses when educatorVipPaidUntil passes (hasEducatorVipAccess
// compares the date, no sweep needed).
export async function completeEducatorVipPurchase(userId: string): Promise<{ educatorVipPaidUntil: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { educatorVipPaidUntil: true } });
  const now = Date.now();
  const base = user?.educatorVipPaidUntil && user.educatorVipPaidUntil.getTime() > now ? user.educatorVipPaidUntil.getTime() : now;
  const educatorVipPaidUntil = new Date(base + EDUCATOR_VIP_PERIOD_DAYS * DAY_MS);
  await prisma.user.update({ where: { id: userId }, data: { educatorVipPaidUntil } });
  return { educatorVipPaidUntil };
}

export class EducatorTrialAlreadyUsedError extends Error {
  constructor() {
    super('You have already used your free trial.');
    this.name = 'EducatorTrialAlreadyUsedError';
  }
}

// One trial per account, ever — educatorVipTrialStartDate being already set
// is the "already used" check (see its own schema comment), so this never
// extends or resets an existing trial. Same shape as startTutorTrial.
export async function startEducatorVipTrial(userId: string): Promise<{ educatorVipTrialEndDate: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { educatorVipTrialStartDate: true } });
  if (user?.educatorVipTrialStartDate) throw new EducatorTrialAlreadyUsedError();

  const now = new Date();
  const educatorVipTrialEndDate = new Date(now.getTime() + EDUCATOR_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { educatorVipTrialStartDate: now, educatorVipTrialEndDate },
  });
  return { educatorVipTrialEndDate };
}

// Called at every one of routes/auth.ts's successful-authentication points
// (register, login, google, github/callback, facebook/callback) — rotates
// this user's currentSessionId to a fresh, unguessable id and returns it so
// the caller can embed it as the JWT's `sid` claim. A second login
// overwrites the value a first device's token was issued with, which is
// exactly what makes requireCurrentEducatorSession (middleware/auth.ts)
// able to detect and reject the older session on its next Educator Hub
// request — see that middleware's own comment for why enforcement is
// scoped to just those routes, not sitewide.
export async function issueSessionId(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  await prisma.user.update({ where: { id: userId }, data: { currentSessionId: sessionId } });
  return sessionId;
}
