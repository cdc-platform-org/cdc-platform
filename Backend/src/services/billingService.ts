import { prisma } from '../lib/prisma';
import { bindCard, BindCardParams } from './paymentGatewayService';
import { detachStripePaymentMethod } from './stripePaymentService';
import { BillingProductType } from '@prisma/client';
import { sendTrialEndingWarningEmail, sendPreDebitReminderEmail, sendSubscriptionCanceledEmail } from './emailService';

// ============================================================
// Unified SaaS billing — base fee + usage-based (token/event) charges per
// active business tool. Mirrors the "Non-Invasive Pause" posture of
// agentBillingService.ts: everything here tracks state and computes what's
// owed, nothing ever attempts a real charge (see paymentGatewayService.ts).
// ============================================================

export class BillingError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'BillingError';
    this.status = status;
    this.details = details;
  }
}

export class PaymentMethodRequiredError extends BillingError {
  constructor() {
    super(402, 'A verified payment method is required to start a trial. Bind a card first.');
    this.name = 'PaymentMethodRequiredError';
  }
}

export class AlreadySubscribedError extends BillingError {
  constructor() {
    super(409, 'This business tool already has an active or trialing subscription.');
    this.name = 'AlreadySubscribedError';
  }
}

export class SubscriptionNotFoundError extends BillingError {
  constructor() {
    super(404, 'Subscription not found.');
    this.name = 'SubscriptionNotFoundError';
  }
}

export class PaymentMethodNotFoundError extends BillingError {
  constructor() {
    super(404, 'Payment method not found.');
    this.name = 'PaymentMethodNotFoundError';
  }
}

// Blocks a card removal that would instantly cancel a live subscription —
// the caller must re-send the request with confirmCancelAutoRenew: true
// once the user has seen this warning.
export class CardRemovalRequiresConfirmationError extends BillingError {
  constructor(affected: { id: string; productType: BillingProductType; referenceId: string }[]) {
    super(
      409,
      'Removing this card will immediately cancel the subscription(s) currently billed to it and revoke access. Resend with confirmCancelAutoRenew: true to proceed.',
      { affectedSubscriptions: affected }
    );
    this.name = 'CardRemovalRequiresConfirmationError';
  }
}

const DEFAULT_BASE_FEE_TETRI = 9900; // 99.00 GEL
const DEFAULT_MARGIN_MULTIPLIER = 3.0;
const DEFAULT_TRIAL_DAYS = 10;

// Length of one recurring billing cycle for an ACTIVE subscription — see
// rolloverActiveBillingPeriods. Same "non-invasive" posture as the rest of
// this file: this only advances currentPeriodStart/currentPeriodEnd and
// resets the usage window, it never attempts a real charge.
const BILLING_CYCLE_DAYS = 30;

// How far ahead of an event (trial end / next charge) its warning fires —
// matches the exact "1 day" commitment in the required notice text, so
// don't change this without updating both email templates in emailService.ts.
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

// Placeholder raw-provider rate — not a real Gemini invoice figure (no
// billing account is wired up to pull actual per-token cost from). Kept as
// a single named constant so it's obvious where to plug in a real number
// later; marginMultiplier (admin-configurable, see BillingSettings) is what
// actually determines the billed amount on top of this.
const AI_TOKEN_RATE_TETRI_PER_1K = 0.5;

export interface ResolvedBillingSettings {
  baseFeeTetri: number;
  marginMultiplier: number;
  trialDays: number;
  // Manual bank-transfer alternative, read-only display data — all three
  // are null unless an admin has actually filled them in (PUT
  // /admin/billing-settings), so the frontend only ever shows real,
  // admin-entered banking details, never a placeholder.
  bankTransferIban: string | null;
  bankTransferBankName: string | null;
  bankTransferAccountName: string | null;
}

export async function getBillingSettings(): Promise<ResolvedBillingSettings> {
  const settings = await prisma.billingSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  return {
    baseFeeTetri: settings?.baseFeeTetri ?? DEFAULT_BASE_FEE_TETRI,
    marginMultiplier: settings?.marginMultiplier ?? DEFAULT_MARGIN_MULTIPLIER,
    trialDays: settings?.trialDays ?? DEFAULT_TRIAL_DAYS,
    bankTransferIban: settings?.bankTransferIban ?? null,
    bankTransferBankName: settings?.bankTransferBankName ?? null,
    bankTransferAccountName: settings?.bankTransferAccountName ?? null,
  };
}

const PRODUCT_LABEL_KA: Record<BillingProductType, string> = {
  AI_AGENT_SUITE: 'AI აგენტების პაკეტი',
  AI_EXAM_PROCTORING: 'AI საგამოცდო ზედამხედველობა',
};

// Instant-access-revocation commitment: called right after a subscription
// is actually flipped to CANCELED (by the user's own cancel action, or as
// a side effect of removing the card funding it) — never called
// speculatively. Two things happen synchronously (must actually have
// landed before the triggering request returns 2xx): the in-app
// Notification, and — the part that makes "revoke access" real rather
// than cosmetic — flipping User.aiSubscriptionActive off for
// AI_AGENT_SUITE. That flag, not BillingSubscription.status, is what
// Backend/src/utils/aiAgentsSuiteAccess.ts actually gates the Business AI
// Agents Suite on; AI_EXAM_PROCTORING has no equivalent standalone access
// flag anywhere in this codebase today, so there's nothing further to
// revoke for that product type yet. The email send is fire-and-forget,
// same posture as every other notification email in this file.
async function revokeAccessAndNotify(
  sub: { id: string; businessId: string; productType: BillingProductType },
  reason: 'USER_CANCELED' | 'PAYMENT_METHOD_REMOVED'
): Promise<void> {
  const business = await prisma.user.findUnique({ where: { id: sub.businessId }, select: { email: true } });
  const productLabel = PRODUCT_LABEL_KA[sub.productType];
  const title = 'გამოწერა გაუქმებულია';
  const message =
    reason === 'PAYMENT_METHOD_REMOVED'
      ? `ბარათის წაშლის გამო თქვენი გამოწერა „${productLabel}“-ზე გაუქმდა და ულიმიტო წვდომა შეწყდა დაუყოვნებლივ.`
      : `თქვენი გამოწერა „${productLabel}“-ზე გაუქმებულია და ულიმიტო წვდომა შეწყდა დაუყოვნებლივ.`;
  await prisma.notification.create({
    data: { userId: sub.businessId, title, message, type: 'BILLING_SUBSCRIPTION_CANCELED' },
  });
  if (sub.productType === 'AI_AGENT_SUITE') {
    await prisma.user.update({ where: { id: sub.businessId }, data: { aiSubscriptionActive: false } });
  }
  if (business?.email) {
    sendSubscriptionCanceledEmail(business.email, productLabel).catch((err) =>
      console.error(`[billingService] sendSubscriptionCanceledEmail failed for ${business.email}:`, err)
    );
  }
}

// ============================================================
// PAYMENT METHODS
// ============================================================

export async function addPaymentMethod(
  userId: string,
  card: BindCardParams,
  opts: { setDefault?: boolean } = {}
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
  if (!user) throw new PaymentMethodNotFoundError(); // can't happen behind `authenticate`, but keeps bindCard's type honest

  const bindResult = await bindCard(card, user); // throws PaymentGatewayError on invalid card

  const existingCount = await prisma.paymentMethod.count({ where: { userId } });
  const makeDefault = opts.setDefault || existingCount === 0;

  return prisma.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.paymentMethod.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return tx.paymentMethod.create({
      data: {
        userId,
        provider: bindResult.provider,
        processorToken: card.processorToken,
        // From bindResult, not the raw `card` param — for STRIPE this is
        // what Stripe's own API reported for the token, not whatever the
        // client happened to send.
        brand: bindResult.brand,
        last4: bindResult.last4,
        expiryMonth: bindResult.expiryMonth,
        expiryYear: bindResult.expiryYear,
        isDefault: makeDefault,
        verifiedAt: bindResult.verifiedAt,
      },
    });
  });
}

// "Swapping" the active card — makes an existing verified card the default,
// so future trial-starts/renewals bill to it.
export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method || method.userId !== userId) throw new PaymentMethodNotFoundError();

  return prisma.$transaction(async (tx) => {
    await tx.paymentMethod.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.paymentMethod.update({ where: { id: paymentMethodId }, data: { isDefault: true } });
  });
}

export async function removePaymentMethod(
  userId: string,
  paymentMethodId: string,
  opts: { confirmCancelAutoRenew?: boolean } = {}
) {
  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method || method.userId !== userId) throw new PaymentMethodNotFoundError();

  const liveSubscriptions = await prisma.billingSubscription.findMany({
    where: {
      paymentMethodId,
      autoRenew: true,
      status: { in: ['TRIALING', 'ACTIVE'] },
    },
    select: { id: true, businessId: true, productType: true, referenceId: true },
  });

  if (liveSubscriptions.length > 0 && !opts.confirmCancelAutoRenew) {
    throw new CardRemovalRequiresConfirmationError(liveSubscriptions);
  }

  await prisma.$transaction(async (tx) => {
    if (liveSubscriptions.length > 0) {
      // Instant cancellation, not just autoRenew: false — a removed card
      // means this subscription can never legitimately renew again, so it
      // shouldn't linger as TRIALING/ACTIVE until the next sweep catches up.
      await tx.billingSubscription.updateMany({
        where: { id: { in: liveSubscriptions.map((s) => s.id) } },
        data: { status: 'CANCELED', autoRenew: false, canceledAt: new Date(), cancellationReason: 'Payment method removed' },
      });
    }
    await tx.paymentMethod.delete({ where: { id: paymentMethodId } });
  });

  // Best-effort, after the local delete has already committed — the local
  // PaymentMethod row (now gone) is what CDC treats as the source of truth
  // for "this card is removed"; a Stripe-side detach failure shouldn't
  // resurrect it or fail this call.
  if (method.provider === 'STRIPE') {
    detachStripePaymentMethod(method.processorToken).catch(() => {});
  }

  for (const sub of liveSubscriptions) {
    await revokeAccessAndNotify(sub, 'PAYMENT_METHOD_REMOVED').catch((err) =>
      console.error(`[billingService] revokeAccessAndNotify failed for subscription ${sub.id}:`, err)
    );
  }
}

// ============================================================
// SUBSCRIPTIONS (10-day trial + auto-renew state)
// ============================================================

export async function startTrialSubscription(
  businessId: string,
  productType: BillingProductType,
  referenceId: string
) {
  const defaultCard = await prisma.paymentMethod.findFirst({
    where: { userId: businessId, isDefault: true, verifiedAt: { not: null } },
  });
  if (!defaultCard) throw new PaymentMethodRequiredError();

  const settings = await getBillingSettings();

  const existing = await prisma.billingSubscription.findUnique({
    where: { businessId_productType_referenceId: { businessId, productType, referenceId } },
  });
  if (existing) {
    if (existing.status === 'TRIALING' || existing.status === 'ACTIVE') {
      throw new AlreadySubscribedError();
    }
    // Previously CANCELED/PAST_DUE — a fresh trial re-activates the same row
    // rather than violating the (businessId, productType, referenceId) unique
    // constraint with a second one.
    return prisma.billingSubscription.update({
      where: { id: existing.id },
      data: {
        status: 'TRIALING',
        baseFeeTetri: settings.baseFeeTetri,
        trialEndsAt: new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: null,
        autoRenew: true,
        paymentMethodId: defaultCard.id,
        canceledAt: null,
        cancellationReason: null,
      },
    });
  }

  try {
    return await prisma.billingSubscription.create({
      data: {
        businessId,
        productType,
        referenceId,
        status: 'TRIALING',
        baseFeeTetri: settings.baseFeeTetri,
        trialEndsAt: new Date(Date.now() + settings.trialDays * 24 * 60 * 60 * 1000),
        autoRenew: true,
        paymentMethodId: defaultCard.id,
      },
    });
  } catch (err: any) {
    // The findUnique above found nothing, but a concurrent duplicate
    // request (a double-click on "start trial") can still race past that
    // check and hit the (businessId, productType, referenceId) unique
    // constraint here — same AlreadySubscribedError the earlier, slower
    // check throws, instead of an unhandled P2002 reaching the client as a
    // raw 500.
    if (err.code === 'P2002') throw new AlreadySubscribedError();
    throw err;
  }
}

export async function setAutoRenew(businessId: string, subscriptionId: string, autoRenew: boolean) {
  const subscription = await prisma.billingSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.businessId !== businessId) throw new SubscriptionNotFoundError();
  return prisma.billingSubscription.update({ where: { id: subscriptionId }, data: { autoRenew } });
}

export async function cancelSubscription(businessId: string, subscriptionId: string, reason?: string) {
  const subscription = await prisma.billingSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.businessId !== businessId) throw new SubscriptionNotFoundError();
  if (subscription.status === 'CANCELED') return subscription;

  // Atomic claim (same pattern as escrowService's releaseEscrow/
  // refundEscrow) — the plain read-then-write above has a gap two
  // near-simultaneous cancel requests (e.g. a double-click, or this
  // racing removePaymentMethod's own instant-cancel) could both pass,
  // both firing revokeAccessAndNotify: a duplicate notification/email and
  // a redundant aiSubscriptionActive write. This `updateMany` only
  // actually flips a row still not-yet-CANCELED; the loser sees count 0
  // and returns the already-canceled row without re-notifying.
  const claim = await prisma.billingSubscription.updateMany({
    where: { id: subscriptionId, status: { not: 'CANCELED' } },
    data: {
      status: 'CANCELED',
      autoRenew: false,
      canceledAt: new Date(),
      cancellationReason: reason ?? null,
    },
  });
  const updated = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  if (claim.count === 0) return updated;
  await revokeAccessAndNotify(updated, 'USER_CANCELED');
  return updated;
}

export async function listMySubscriptions(businessId: string) {
  return prisma.billingSubscription.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    include: { paymentMethod: { select: { brand: true, last4: true } } },
  });
}

// Non-invasive trial/period-expiry sweep — same shape as
// agentBillingService.pauseExpiredTrialAgents, extended to cover every
// BillingSubscription rather than just the legacy Agent.status field.
// TRIALING past trialEndsAt: ACTIVE if autoRenew + a verified card is still
// attached (still never actually charges — see paymentGatewayService.ts),
// otherwise PAST_DUE.
export async function sweepExpiredTrials(): Promise<{ activatedIds: string[]; pastDueIds: string[] }> {
  const expired = await prisma.billingSubscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lte: new Date() } },
    include: { paymentMethod: true },
  });
  const activatedIds: string[] = [];
  const pastDueIds: string[] = [];
  for (const sub of expired) {
    const canActivate = sub.autoRenew && sub.paymentMethod?.verifiedAt;
    const now = new Date();
    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: canActivate ? 'ACTIVE' : 'PAST_DUE',
        currentPeriodStart: now,
        // Marks when the first recurring "charge" (still non-invasive —
        // see rolloverActiveBillingPeriods) is due, so
        // sweepRenewalReminders has something concrete to warn ahead of.
        // Left null on the PAST_DUE branch — there's no live cycle to
        // remind about until autoRenew/a verified card comes back.
        currentPeriodEnd: canActivate ? new Date(now.getTime() + BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000) : null,
      },
    });
    (canActivate ? activatedIds : pastDueIds).push(sub.id);
  }
  return { activatedIds, pastDueIds };
}

// Advances every ACTIVE subscription whose current cycle has ended —
// mirrors sweepExpiredTrials's own canActivate check (autoRenew + a still-
// verified default card) so a card removed mid-cycle correctly stops the
// clock instead of silently rolling forward forever. Still never attempts
// a real charge, same "Non-Invasive Pause" posture as the rest of this
// file — this only advances the tracked cycle and resets the usage window
// (getCurrentCycleUsageTetri sums from currentPeriodStart) and the
// per-cycle reminder flag so the next cycle gets its own pre-debit notice.
export async function rolloverActiveBillingPeriods(): Promise<{ rolledOverIds: string[]; pastDueIds: string[] }> {
  const due = await prisma.billingSubscription.findMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { lte: new Date() } },
    include: { paymentMethod: true },
  });
  const rolledOverIds: string[] = [];
  const pastDueIds: string[] = [];
  for (const sub of due) {
    const canRenew = sub.autoRenew && sub.paymentMethod?.verifiedAt;
    const periodEnd = sub.currentPeriodEnd ?? new Date();
    if (canRenew) {
      await prisma.billingSubscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodStart: periodEnd,
          currentPeriodEnd: new Date(periodEnd.getTime() + BILLING_CYCLE_DAYS * 24 * 60 * 60 * 1000),
          renewalReminderSentAt: null,
        },
      });
      rolledOverIds.push(sub.id);
    } else {
      await prisma.billingSubscription.update({
        where: { id: sub.id },
        data: { status: 'PAST_DUE', currentPeriodEnd: null },
      });
      pastDueIds.push(sub.id);
    }
  }
  return { rolledOverIds, pastDueIds };
}

// Ethical-billing commitment #1: warn 1 day before trial access could
// lapse, so a user is never surprised by a sudden loss of access. Fires
// once per trial (trialWarningSentAt guards re-sends) — in-app
// Notification + email, both with the exact required wording.
export async function sweepTrialEndingWarnings(): Promise<{ notifiedIds: string[] }> {
  const dueSoon = await prisma.billingSubscription.findMany({
    where: {
      status: 'TRIALING',
      trialWarningSentAt: null,
      trialEndsAt: { lte: new Date(Date.now() + REMINDER_WINDOW_MS), gt: new Date() },
    },
    include: { business: { select: { id: true, email: true } } },
  });
  const notifiedIds: string[] = [];
  for (const sub of dueSoon) {
    const title = 'თქვენი საცდელი პერიოდი მალე იწურება';
    const message = 'თქვენს საცდელ პერიოდს ვადა 1 დღეში ეწურება. წვდომის გასაგრძელებლად შეგიძლიათ გადაიხადოთ დაშბორდიდან.';
    await prisma.notification.create({
      data: { userId: sub.businessId, title, message, type: 'BILLING_TRIAL_ENDING' },
    });
    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: { trialWarningSentAt: new Date() },
    });
    if (sub.business.email) {
      sendTrialEndingWarningEmail(sub.business.email).catch((err) =>
        console.error(`[billingService] sendTrialEndingWarningEmail failed for ${sub.business.email}:`, err)
      );
    }
    notifiedIds.push(sub.id);
  }
  return { notifiedIds };
}

// Ethical-billing commitment #2: no surprise charges — always a heads-up
// before a recurring debit, only for subscriptions the user actually
// opted into (autoRenew on + a verified card), with the exact required
// wording that also names the opt-out (delete the card in Settings).
// Fires once per cycle (renewalReminderSentAt, cleared on each
// rolloverActiveBillingPeriods advance).
export async function sweepRenewalReminders(): Promise<{ notifiedIds: string[] }> {
  const dueSoon = await prisma.billingSubscription.findMany({
    where: {
      status: 'ACTIVE',
      autoRenew: true,
      renewalReminderSentAt: null,
      currentPeriodEnd: { lte: new Date(Date.now() + REMINDER_WINDOW_MS), gt: new Date() },
      paymentMethod: { verifiedAt: { not: null } },
    },
    include: { business: { select: { id: true, email: true } } },
  });
  const notifiedIds: string[] = [];
  for (const sub of dueSoon) {
    const title = 'მოახლოებული გადახდა თქვენს ანგარიშზე';
    const message =
      'თანხის ჩამოჭრის დროა. თუ გსურთ მომსახურების გაგრძელება, გთხოვთ დაახვედროთ საკმარისი თანხა ბარათზე. თუ არ გსურთ გაგრძელება, შეგიძლიათ წაშალოთ ბარათი პარამეტრებიდან.';
    await prisma.notification.create({
      data: { userId: sub.businessId, title, message, type: 'BILLING_RENEWAL_REMINDER' },
    });
    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: { renewalReminderSentAt: new Date() },
    });
    if (sub.business.email) {
      sendPreDebitReminderEmail(sub.business.email).catch((err) =>
        console.error(`[billingService] sendPreDebitReminderEmail failed for ${sub.business.email}:`, err)
      );
    }
    notifiedIds.push(sub.id);
  }
  return { notifiedIds };
}

// ============================================================
// USAGE TRACKING — one call per billable AI Agent execution.
// ============================================================

export interface RecordAgentUsageParams {
  businessId: string;
  agentId: string;
  promptTokens: number;
  completionTokens: number;
}

// Silently no-ops if the agent has no billing subscription yet (agents
// created before this feature existed still run on the legacy
// Agent.trialEndsAt free trial) — usage tracking must never block a chat
// reply from being returned to the visitor.
export async function recordAgentUsage(params: RecordAgentUsageParams) {
  const subscription = await prisma.billingSubscription.findUnique({
    where: {
      businessId_productType_referenceId: {
        businessId: params.businessId,
        productType: BillingProductType.AI_AGENT_SUITE,
        referenceId: params.agentId,
      },
    },
  });
  if (!subscription) return null;

  const settings = await getBillingSettings();
  const totalTokens = params.promptTokens + params.completionTokens;
  const rawCostTetri = Math.round((totalTokens / 1000) * AI_TOKEN_RATE_TETRI_PER_1K);
  const billedCostTetri = Math.round(rawCostTetri * settings.marginMultiplier);

  return prisma.usageRecord.create({
    data: {
      subscriptionId: subscription.id,
      agentId: params.agentId,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      rawCostTetri,
      billedCostTetri,
      marginMultiplier: settings.marginMultiplier,
    },
  });
}

export interface RecordExamGradingUsageParams {
  businessId: string;
  examSessionId: string;
  examSubmissionId: string;
  promptTokens: number;
  completionTokens: number;
}

// Same no-op-if-no-subscription posture as recordAgentUsage above — grading
// must never fail because billing metadata is missing.
export async function recordExamGradingUsage(params: RecordExamGradingUsageParams) {
  const subscription = await prisma.billingSubscription.findUnique({
    where: {
      businessId_productType_referenceId: {
        businessId: params.businessId,
        productType: BillingProductType.AI_EXAM_PROCTORING,
        referenceId: params.examSessionId,
      },
    },
  });
  if (!subscription) return null;

  const settings = await getBillingSettings();
  const totalTokens = params.promptTokens + params.completionTokens;
  const rawCostTetri = Math.round((totalTokens / 1000) * AI_TOKEN_RATE_TETRI_PER_1K);
  const billedCostTetri = Math.round(rawCostTetri * settings.marginMultiplier);

  return prisma.usageRecord.create({
    data: {
      subscriptionId: subscription.id,
      examSubmissionId: params.examSubmissionId,
      eventType: 'EXAM_GRADING',
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens,
      rawCostTetri,
      billedCostTetri,
      marginMultiplier: settings.marginMultiplier,
    },
  });
}

export async function getCurrentCycleUsageTetri(subscriptionId: string): Promise<number> {
  const subscription = await prisma.billingSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new SubscriptionNotFoundError();
  const result = await prisma.usageRecord.aggregate({
    where: { subscriptionId, createdAt: { gte: subscription.currentPeriodStart } },
    _sum: { billedCostTetri: true },
  });
  return result._sum.billedCostTetri ?? 0;
}
