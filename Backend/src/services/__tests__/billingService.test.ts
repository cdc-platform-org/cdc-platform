import { prisma } from '../../lib/prisma';
import {
  cancelSubscription,
  removePaymentMethod,
  startTrialSubscription,
  CardRemovalRequiresConfirmationError,
  PaymentMethodRequiredError,
  AlreadySubscribedError,
} from '../billingService';
import { createUser, createVerifiedPaymentMethod, createBillingSubscription } from '../../test/factories';
import { BillingProductType } from '@prisma/client';

afterAll(async () => {
  await prisma.$disconnect();
});

async function businessWithActiveAiAgentSubscription() {
  const business = await createUser({ aiSubscriptionActive: true });
  const card = await createVerifiedPaymentMethod({ userId: business.id });
  const subscription = await createBillingSubscription({
    businessId: business.id,
    productType: BillingProductType.AI_AGENT_SUITE,
    paymentMethodId: card.id,
    status: 'ACTIVE',
    autoRenew: true,
  });
  return { business, card, subscription };
}

describe('billingService', () => {
  describe('cancelSubscription', () => {
    it('cancels the subscription and instantly revokes AI_AGENT_SUITE access', async () => {
      const { business, subscription } = await businessWithActiveAiAgentSubscription();

      const result = await cancelSubscription(business.id, subscription.id);
      expect(result.status).toBe('CANCELED');
      expect(result.autoRenew).toBe(false);

      const updatedBusiness = await prisma.user.findUniqueOrThrow({ where: { id: business.id } });
      expect(updatedBusiness.aiSubscriptionActive).toBe(false);

      const notifications = await prisma.notification.findMany({
        where: { userId: business.id, type: 'BILLING_SUBSCRIPTION_CANCELED' },
      });
      expect(notifications).toHaveLength(1);
    });

    it('is idempotent — canceling an already-CANCELED subscription is a no-op, no duplicate notification', async () => {
      const { business, subscription } = await businessWithActiveAiAgentSubscription();
      await cancelSubscription(business.id, subscription.id);
      await cancelSubscription(business.id, subscription.id);

      const notifications = await prisma.notification.findMany({
        where: { userId: business.id, type: 'BILLING_SUBSCRIPTION_CANCELED' },
      });
      expect(notifications).toHaveLength(1); // still just one, not two
    });

    it('atomic claim: two concurrent cancel requests only revoke/notify once', async () => {
      const { business, subscription } = await businessWithActiveAiAgentSubscription();

      await Promise.allSettled([cancelSubscription(business.id, subscription.id), cancelSubscription(business.id, subscription.id)]);

      const updated = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: subscription.id } });
      expect(updated.status).toBe('CANCELED');

      const notifications = await prisma.notification.findMany({
        where: { userId: business.id, type: 'BILLING_SUBSCRIPTION_CANCELED' },
      });
      expect(notifications).toHaveLength(1); // exactly one revoke/notify fired, not two
    });
  });

  describe('removePaymentMethod', () => {
    it('refuses to remove a card funding a live subscription without explicit confirmation', async () => {
      const { business, card } = await businessWithActiveAiAgentSubscription();
      await expect(removePaymentMethod(business.id, card.id)).rejects.toThrow(CardRemovalRequiresConfirmationError);

      const stillThere = await prisma.paymentMethod.findUnique({ where: { id: card.id } });
      expect(stillThere).not.toBeNull();
    });

    it('with confirmation: deletes the card, instantly cancels the subscription, and revokes access', async () => {
      const { business, card, subscription } = await businessWithActiveAiAgentSubscription();

      await removePaymentMethod(business.id, card.id, { confirmCancelAutoRenew: true });

      const deletedCard = await prisma.paymentMethod.findUnique({ where: { id: card.id } });
      expect(deletedCard).toBeNull();

      const updatedSub = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: subscription.id } });
      expect(updatedSub.status).toBe('CANCELED');

      const updatedBusiness = await prisma.user.findUniqueOrThrow({ where: { id: business.id } });
      expect(updatedBusiness.aiSubscriptionActive).toBe(false);
    });

    it('removing a card with no live subscriptions needs no confirmation', async () => {
      const business = await createUser();
      const card = await createVerifiedPaymentMethod({ userId: business.id });

      await expect(removePaymentMethod(business.id, card.id)).resolves.toBeUndefined();
      const deletedCard = await prisma.paymentMethod.findUnique({ where: { id: card.id } });
      expect(deletedCard).toBeNull();
    });
  });

  describe('startTrialSubscription', () => {
    it('requires a verified default payment method', async () => {
      const business = await createUser();
      await expect(
        startTrialSubscription(business.id, BillingProductType.AI_AGENT_SUITE, 'agent-1')
      ).rejects.toThrow(PaymentMethodRequiredError);
    });

    it('starts TRIALING once a verified default card is on file', async () => {
      const business = await createUser();
      await createVerifiedPaymentMethod({ userId: business.id, isDefault: true });

      const subscription = await startTrialSubscription(business.id, BillingProductType.AI_AGENT_SUITE, 'agent-1');
      expect(subscription.status).toBe('TRIALING');
      expect(subscription.trialEndsAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('a double-click race (two concurrent calls) throws AlreadySubscribedError on the loser, not an unhandled P2002', async () => {
      const business = await createUser();
      await createVerifiedPaymentMethod({ userId: business.id, isDefault: true });

      // Both calls pass the findUnique pre-check before either has committed
      // — the loser must hit the (businessId, productType, referenceId)
      // unique constraint at create() and translate it to the same clean
      // error the earlier, slower check would have thrown.
      const results = await Promise.allSettled([
        startTrialSubscription(business.id, BillingProductType.AI_AGENT_SUITE, 'agent-1'),
        startTrialSubscription(business.id, BillingProductType.AI_AGENT_SUITE, 'agent-1'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(AlreadySubscribedError);

      const subscriptions = await prisma.billingSubscription.findMany({
        where: { businessId: business.id, productType: BillingProductType.AI_AGENT_SUITE, referenceId: 'agent-1' },
      });
      expect(subscriptions).toHaveLength(1); // not double-created
    });
  });
});
