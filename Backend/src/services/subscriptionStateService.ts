import { prisma } from '../lib/prisma';
import { BillingProductType } from '@prisma/client';
import { hasAiAgentsSuiteAccess } from '../utils/aiAgentsSuiteAccess';

// ============================================================
// Single source of truth for "does this business have access to product X"
// — reconciles the two systems that can actually grant AI_AGENT_SUITE
// access today:
//
//   1. BillingSubscription (billingService.ts) — the unified billing engine.
//      Fully built (atomic-claim cancel, instant revocation, usage
//      tracking) but as of this writing has NO real entry point: nothing in
//      the Frontend ever calls POST /billing/subscriptions/trial, so no
//      business has ever actually acquired an AI_AGENT_SUITE row through
//      the product. It exists ahead of its own UI.
//   2. User.aiTrialEndsAt / aiSubscriptionActive — the system that actually
//      gates access today (see utils/aiAgentsSuiteAccess.ts), granted
//      automatically on KYC business verification (routes/auth.ts,
//      routes/adminCompanies.ts) or manually by a SuperAdmin
//      (routes/admin.ts's PATCH .../ai-trial).
//
// Before this, routes/aiAgentsSuite.ts read #2 directly — correct today
// (since #1 has no way to be populated), but a landmine: if a future
// change wires a real trial-start UI to BillingSubscription, those rows
// would silently do nothing, because nothing ever read them. This function
// is the one place that decision is made, so wiring up BillingSubscription
// later is a matter of it actually being read (already true here), not a
// second access-check to remember to update.
//
// Deliberately does NOT cover Agent.trialEndsAt (agentBillingService.ts /
// routes/chatApi.ts) — that is a genuinely separate product, the per-
// embeddable-chatbot-widget trial, with no relationship to whether the
// owning business has Suite access (see aiAgentsSuiteAccess.ts's own
// comment). Folding it in here would couple two things the product
// deliberately keeps independent, not "reconcile" anything.
// ============================================================

export type SubscriptionAccessSource = 'ADMIN_OVERRIDE' | 'BILLING_SUBSCRIPTION' | 'LEGACY_TRIAL_FLAG' | 'NONE';

export interface SubscriptionState {
  hasAccess: boolean;
  source: SubscriptionAccessSource;
  // Set only when access is currently trial-based (either system) — null
  // for an ACTIVE BillingSubscription, an aiSubscriptionActive flag grant,
  // an admin override, or no access at all.
  trialEndsAt: Date | null;
}

const NO_ACCESS: SubscriptionState = { hasAccess: false, source: 'NONE', trialEndsAt: null };

export async function getSubscriptionState(
  userId: string,
  productType: BillingProductType = BillingProductType.AI_AGENT_SUITE
): Promise<SubscriptionState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, aiTrialEndsAt: true, aiSubscriptionActive: true },
  });
  if (!user) return NO_ACCESS;
  if (user.role === 'SuperAdmin') return { hasAccess: true, source: 'ADMIN_OVERRIDE', trialEndsAt: null };
  // Both systems only ever grant a Business (Client) account access — see
  // aiAgentsSuiteAccess.ts's own comment for why this stays a hard gate
  // rather than per-system.
  if (user.role !== 'Client') return NO_ACCESS;

  // Checked first — see the module comment for why a real BillingSubscription
  // takes precedence over the legacy flag grant whenever one exists.
  const subscription = await prisma.billingSubscription.findFirst({
    where: { businessId: userId, productType, status: { in: ['TRIALING', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (subscription) {
    return {
      hasAccess: true,
      source: 'BILLING_SUBSCRIPTION',
      trialEndsAt: subscription.status === 'TRIALING' ? subscription.trialEndsAt : null,
    };
  }

  // No AI_EXAM_PROCTORING equivalent exists in the legacy flag system (see
  // module comment) — only AI_AGENT_SUITE has a fallback to check here.
  if (productType === BillingProductType.AI_AGENT_SUITE && hasAiAgentsSuiteAccess(user)) {
    const trialActive = !!user.aiTrialEndsAt && user.aiTrialEndsAt.getTime() > Date.now();
    return { hasAccess: true, source: 'LEGACY_TRIAL_FLAG', trialEndsAt: trialActive ? user.aiTrialEndsAt : null };
  }

  return NO_ACCESS;
}
