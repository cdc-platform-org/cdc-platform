import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ============================================================
// AI English Tutor (IMIAKO) subscription lifecycle — the cardless 5-day
// trial, the flat 50 GEL/month purchase's fulfillment, and its expiry
// sweep. Deliberately NOT the BillingSubscription engine (see
// User.tutorSubscriptionTier's own schema comment) — no recurring charge
// is ever automated here; see tutorSubscriptionAutoRenew's own comment for
// what that flag actually controls (a pre-expiry reminder, not a charge).
// ============================================================

export const TUTOR_TRIAL_DAYS = 5;
export const TUTOR_SUBSCRIPTION_PRICE_GEL = 5000; // 50.00 GEL, minor units (tetri)
const TUTOR_SUBSCRIPTION_PERIOD_DAYS = 30;

export class TutorTrialAlreadyUsedError extends Error {
  constructor() {
    super('You have already used your free trial.');
    this.name = 'TutorTrialAlreadyUsedError';
  }
}

// One trial per account, ever — tutorTrialStartDate being already set is
// the "already used" check (see its own schema comment), so this never
// extends or resets an existing trial.
export async function startTutorTrial(userId: string): Promise<{ tutorTrialEndDate: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorTrialStartDate: true } });
  if (user?.tutorTrialStartDate) throw new TutorTrialAlreadyUsedError();

  const now = new Date();
  const tutorTrialEndDate = new Date(now.getTime() + TUTOR_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { tutorTrialStartDate: now, tutorTrialEndDate },
  });
  return { tutorTrialEndDate };
}

export interface TutorSubscriptionResult {
  tutorSubscriptionPeriodEnd: Date;
}

// Fulfillment for a confirmed ENGLISH_TUTOR_SUBSCRIPTION payment — called
// from both routes/payments.ts's BOG callback and routes/stripePayments.ts's
// Stripe webhook, once terminal COMPLETED status is confirmed. Idempotent
// on a retried webhook delivery in the sense that it never loses time (an
// early renewal EXTENDS from the later of "now" or the current
// tutorSubscriptionPeriodEnd, never resets it backward) — a redelivered
// webhook for the same purchase would double-extend by 30 days, which is
// an acceptable rare-retry cost given this codebase's existing "mock only
// the external call, not the DB" test posture makes true webhook
// idempotency keys out of scope for this pass, same tradeoff already
// accepted elsewhere (see LiveTrainingSaleResult's own comment on retries
// being a harmless no-op there — this one differs only in that a double
// delivery here extends access rather than no-op'ing, still never
// *reduces* what the student is owed).
export async function completeTutorSubscriptionPurchase(userId: string): Promise<TutorSubscriptionResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorSubscriptionPeriodEnd: true } });
  const now = new Date();
  const base = user?.tutorSubscriptionPeriodEnd && user.tutorSubscriptionPeriodEnd.getTime() > now.getTime() ? user.tutorSubscriptionPeriodEnd : now;
  const tutorSubscriptionPeriodEnd = new Date(base.getTime() + TUTOR_SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      tutorSubscriptionTier: 'PRO',
      tutorSubscriptionPeriodEnd,
      tutorSubscriptionAutoRenew: true,
    },
  });
  return { tutorSubscriptionPeriodEnd };
}

// Idempotent counterpart to completeTutorSubscriptionPurchase, for the one
// call site that can race itself: routes/stripePayments.ts's webhook and
// its GET /status/:paymentId reconciliation poll can both observe the same
// StripePayment row as PENDING before either has written, then both call
// into fulfillment — completeTutorSubscriptionPurchase's own comment above
// documents that a second call for the same purchase would double-extend
// by 30 days. This takes the same SELECT...FOR UPDATE row-lock pattern
// learningPaymentFulfillment.completeLearningPayment already uses for
// COURSE/LIVE_TRAINING: the StripePayment row is locked inside a
// transaction, its status re-checked under that lock, and the subscription
// extension + COMPLETED transition commit together — so only the first
// caller to reach the lock ever extends the subscription, and a redelivered
// webhook (or the losing side of the race) sees status !== PENDING and
// no-ops. See completeTutorSubscriptionBogPayment below for BOG's identical
// counterpart (same shape, same race, same fix — just a different payment
// table and no payment-intent id to persist).
export async function completeTutorSubscriptionStripePayment(
  stripePaymentId: string,
  rawEvent: unknown,
  paymentIntentId?: string | null
): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM stripe_payments WHERE id = ${stripePaymentId} FOR UPDATE`;
    const payment = await tx.stripePayment.findUnique({ where: { id: stripePaymentId } });
    if (!payment || payment.purpose !== 'ENGLISH_TUTOR_SUBSCRIPTION') return { handled: false };
    if (payment.status !== 'PENDING') return { handled: true }; // already completed/failed by the other racer — no-op

    const now = new Date();
    const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { tutorSubscriptionPeriodEnd: true } });
    const base = user?.tutorSubscriptionPeriodEnd && user.tutorSubscriptionPeriodEnd.getTime() > now.getTime() ? user.tutorSubscriptionPeriodEnd : now;
    const tutorSubscriptionPeriodEnd = new Date(base.getTime() + TUTOR_SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await tx.user.update({
      where: { id: payment.userId },
      data: { tutorSubscriptionTier: 'PRO', tutorSubscriptionPeriodEnd, tutorSubscriptionAutoRenew: true },
    });
    await tx.stripePayment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        rawEvent: rawEvent as Prisma.InputJsonValue,
        stripePaymentIntentId: paymentIntentId ?? null,
      },
    });
    return { handled: true };
  });
  return result.handled;
}

// BOG's counterpart to completeTutorSubscriptionStripePayment above — the
// same race exists on this gateway: routes/payments.ts's BOG callback and
// its GET /bog/status/:paymentId reconciliation poll can both observe the
// same BogPayment row as PENDING and both call into fulfillment. Same
// SELECT...FOR UPDATE row-lock pattern, same re-check-under-lock, same
// atomic extension + COMPLETED transition — only the first caller to reach
// the lock ever extends the subscription.
export async function completeTutorSubscriptionBogPayment(bogPaymentId: string, rawCallback: unknown): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bog_payments WHERE id = ${bogPaymentId} FOR UPDATE`;
    const payment = await tx.bogPayment.findUnique({ where: { id: bogPaymentId } });
    if (!payment || payment.purpose !== 'ENGLISH_TUTOR_SUBSCRIPTION') return { handled: false };
    if (payment.status !== 'PENDING') return { handled: true }; // already completed/failed by the other racer — no-op

    const now = new Date();
    const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { tutorSubscriptionPeriodEnd: true } });
    const base = user?.tutorSubscriptionPeriodEnd && user.tutorSubscriptionPeriodEnd.getTime() > now.getTime() ? user.tutorSubscriptionPeriodEnd : now;
    const tutorSubscriptionPeriodEnd = new Date(base.getTime() + TUTOR_SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await tx.user.update({
      where: { id: payment.userId },
      data: { tutorSubscriptionTier: 'PRO', tutorSubscriptionPeriodEnd, tutorSubscriptionAutoRenew: true },
    });
    await tx.bogPayment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', completedAt: now, rawCallback: rawCallback as Prisma.InputJsonValue },
    });
    return { handled: true };
  });
  return result.handled;
}

// POST /english-tutor/subscription/cancel — turns off the pre-expiry
// renewal reminder (see tutorSubscriptionAutoRenew's own schema comment).
// Never itself touches tutorSubscriptionTier — access is untouched until
// sweepExpiredTutorSubscriptions() below actually reaches
// tutorSubscriptionPeriodEnd, cancelled or not.
export async function cancelTutorSubscriptionAutoRenew(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { tutorSubscriptionAutoRenew: false } });
}

// Cron/interval sweep (wired in server.ts, same dual-registration
// convention as e.g. cancelAbandonedMentorshipBookings) — reverts
// tutorSubscriptionTier to FREE once tutorSubscriptionPeriodEnd has passed,
// REGARDLESS of tutorSubscriptionAutoRenew: nothing here ever actually
// re-charges a card, so a "still auto-renew: true" row that was never
// actually repurchased must not silently stay PRO forever — that would be
// the exact same revenue-integrity bug the live-training payment fix
// addressed, just for this product instead. Also clears
// tutorSubscriptionPeriodEnd so a later resubscribe starts a clean new
// period rather than reading a stale past date.
export async function sweepExpiredTutorSubscriptions(): Promise<number> {
  const now = new Date();
  const result = await prisma.user.updateMany({
    where: { tutorSubscriptionTier: 'PRO', tutorSubscriptionPeriodEnd: { lt: now } },
    data: { tutorSubscriptionTier: 'FREE', tutorSubscriptionPeriodEnd: null },
  });
  return result.count;
}
