import { prisma } from '../lib/prisma';
import { bindCard, BindCardParams } from './paymentGatewayService';
import { detachStripePaymentMethod } from './stripePaymentService';
import { BillingProductType } from '@prisma/client';

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

// Blocks a card removal that would silently kill auto-renew on a live
// subscription — the caller must re-send the request with
// confirmCancelAutoRenew: true once the user has seen this warning.
export class CardRemovalRequiresConfirmationError extends BillingError {
  constructor(affected: { id: string; productType: BillingProductType; referenceId: string }[]) {
    super(
      409,
      'Removing this card will turn off auto-renew for subscriptions currently billed to it. Resend with confirmCancelAutoRenew: true to proceed.',
      { affectedSubscriptions: affected }
    );
    this.name = 'CardRemovalRequiresConfirmationError';
  }
}

const DEFAULT_BASE_FEE_TETRI = 9900; // 99.00 GEL
const DEFAULT_MARGIN_MULTIPLIER = 3.0;
const DEFAULT_TRIAL_DAYS = 10;

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
}

export async function getBillingSettings(): Promise<ResolvedBillingSettings> {
  const settings = await prisma.billingSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  return {
    baseFeeTetri: settings?.baseFeeTetri ?? DEFAULT_BASE_FEE_TETRI,
    marginMultiplier: settings?.marginMultiplier ?? DEFAULT_MARGIN_MULTIPLIER,
    trialDays: settings?.trialDays ?? DEFAULT_TRIAL_DAYS,
  };
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
    select: { id: true, productType: true, referenceId: true },
  });

  if (liveSubscriptions.length > 0 && !opts.confirmCancelAutoRenew) {
    throw new CardRemovalRequiresConfirmationError(liveSubscriptions);
  }

  await prisma.$transaction(async (tx) => {
    if (liveSubscriptions.length > 0) {
      await tx.billingSubscription.updateMany({
        where: { id: { in: liveSubscriptions.map((s) => s.id) } },
        data: { autoRenew: false },
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

  return prisma.billingSubscription.create({
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
}

export async function setAutoRenew(businessId: string, subscriptionId: string, autoRenew: boolean) {
  const subscription = await prisma.billingSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.businessId !== businessId) throw new SubscriptionNotFoundError();
  return prisma.billingSubscription.update({ where: { id: subscriptionId }, data: { autoRenew } });
}

export async function cancelSubscription(businessId: string, subscriptionId: string, reason?: string) {
  const subscription = await prisma.billingSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription || subscription.businessId !== businessId) throw new SubscriptionNotFoundError();
  return prisma.billingSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELED',
      autoRenew: false,
      canceledAt: new Date(),
      cancellationReason: reason ?? null,
    },
  });
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
    await prisma.billingSubscription.update({
      where: { id: sub.id },
      data: {
        status: canActivate ? 'ACTIVE' : 'PAST_DUE',
        currentPeriodStart: new Date(),
      },
    });
    (canActivate ? activatedIds : pastDueIds).push(sub.id);
  }
  return { activatedIds, pastDueIds };
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
