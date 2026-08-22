import { prisma } from '../../lib/prisma';
import { getSubscriptionState } from '../subscriptionStateService';
import { createUser, createBillingSubscription } from '../../test/factories';
import { BillingProductType } from '@prisma/client';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('getSubscriptionState', () => {
  it('returns NONE for a user that does not exist', async () => {
    const state = await getSubscriptionState('00000000-0000-0000-0000-000000000000');
    expect(state).toEqual({ hasAccess: false, source: 'NONE', trialEndsAt: null });
  });

  it('grants ADMIN_OVERRIDE access to a SuperAdmin regardless of any flag/subscription state', async () => {
    const admin = await createUser({ role: 'SuperAdmin', aiSubscriptionActive: false, aiTrialEndsAt: null });
    const state = await getSubscriptionState(admin.id);
    expect(state).toEqual({ hasAccess: true, source: 'ADMIN_OVERRIDE', trialEndsAt: null });
  });

  it('denies a non-Client role even with the legacy flags set', async () => {
    const student = await createUser({ role: 'Student', aiSubscriptionActive: true });
    const state = await getSubscriptionState(student.id);
    expect(state.hasAccess).toBe(false);
    expect(state.source).toBe('NONE');
  });

  it('denies a Client with neither a subscription nor a legacy flag', async () => {
    const client = await createUser({ role: 'Client' });
    const state = await getSubscriptionState(client.id);
    expect(state).toEqual({ hasAccess: false, source: 'NONE', trialEndsAt: null });
  });

  describe('legacy flag system (aiTrialEndsAt / aiSubscriptionActive)', () => {
    it('grants access via aiSubscriptionActive with no trial-end date', async () => {
      const client = await createUser({ role: 'Client', aiSubscriptionActive: true });
      const state = await getSubscriptionState(client.id);
      expect(state).toEqual({ hasAccess: true, source: 'LEGACY_TRIAL_FLAG', trialEndsAt: null });
    });

    it('grants access via an unexpired aiTrialEndsAt', async () => {
      const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const client = await createUser({ role: 'Client', aiTrialEndsAt: trialEndsAt });
      const state = await getSubscriptionState(client.id);
      expect(state.hasAccess).toBe(true);
      expect(state.source).toBe('LEGACY_TRIAL_FLAG');
      expect(state.trialEndsAt?.getTime()).toBe(trialEndsAt.getTime());
    });

    it('denies access once aiTrialEndsAt has passed with no active subscription flag', async () => {
      const client = await createUser({ role: 'Client', aiTrialEndsAt: new Date(Date.now() - 1000) });
      const state = await getSubscriptionState(client.id);
      expect(state).toEqual({ hasAccess: false, source: 'NONE', trialEndsAt: null });
    });
  });

  describe('BillingSubscription precedence', () => {
    it('grants access via an ACTIVE BillingSubscription even with no legacy flags set', async () => {
      const client = await createUser({ role: 'Client' });
      await createBillingSubscription({ businessId: client.id, productType: BillingProductType.AI_AGENT_SUITE, status: 'ACTIVE' });

      const state = await getSubscriptionState(client.id);
      expect(state.hasAccess).toBe(true);
      expect(state.source).toBe('BILLING_SUBSCRIPTION');
      expect(state.trialEndsAt).toBeNull(); // ACTIVE, not TRIALING — no trial-end to report
    });

    it('grants access via a TRIALING BillingSubscription and surfaces its trial-end date', async () => {
      const client = await createUser({ role: 'Client' });
      const sub = await createBillingSubscription({
        businessId: client.id,
        productType: BillingProductType.AI_AGENT_SUITE,
        status: 'TRIALING',
      });

      const state = await getSubscriptionState(client.id);
      expect(state.source).toBe('BILLING_SUBSCRIPTION');
      expect(state.trialEndsAt?.getTime()).toBe(sub.trialEndsAt.getTime());
    });

    it('prefers a live BillingSubscription over the legacy flag when both are present', async () => {
      const client = await createUser({ role: 'Client', aiSubscriptionActive: true });
      await createBillingSubscription({ businessId: client.id, productType: BillingProductType.AI_AGENT_SUITE, status: 'ACTIVE' });

      const state = await getSubscriptionState(client.id);
      expect(state.source).toBe('BILLING_SUBSCRIPTION'); // not LEGACY_TRIAL_FLAG
    });

    it('falls back to the legacy flag when the only BillingSubscription is CANCELED', async () => {
      const client = await createUser({ role: 'Client', aiSubscriptionActive: true });
      await createBillingSubscription({ businessId: client.id, productType: BillingProductType.AI_AGENT_SUITE, status: 'CANCELED' });

      const state = await getSubscriptionState(client.id);
      expect(state.hasAccess).toBe(true);
      expect(state.source).toBe('LEGACY_TRIAL_FLAG'); // CANCELED subscription is ignored, flag still grants
    });

    it('ignores a live BillingSubscription for a different product type', async () => {
      const client = await createUser({ role: 'Client' });
      await createBillingSubscription({ businessId: client.id, productType: BillingProductType.AI_EXAM_PROCTORING, status: 'ACTIVE' });

      const state = await getSubscriptionState(client.id, BillingProductType.AI_AGENT_SUITE);
      expect(state).toEqual({ hasAccess: false, source: 'NONE', trialEndsAt: null });
    });
  });
});
