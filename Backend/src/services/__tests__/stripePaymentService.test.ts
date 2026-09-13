import { createStripeCheckoutSession, CreateStripeCheckoutSessionParams } from '../stripePaymentService';

const mockCreateSession = jest.fn();
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({
  checkout: { sessions: { create: mockCreateSession } },
})));
jest.mock('../../lib/prisma', () => ({ prisma: {} }));
jest.mock('../../utils/env', () => ({
  STRIPE_SECRET_KEY: 'sk_test_mocked_sdk_no_network',
  STRIPE_WEBHOOK_SECRET: 'whsec_mocked_sdk_no_network',
}));

const checkout: CreateStripeCheckoutSessionParams = {
  externalOrderId: 'test-learning-checkout', amount: 3500, currency: 'eur', productName: 'Test learning session',
  successUrl: 'https://example.test/success', cancelUrl: 'https://example.test/cancel',
};

beforeEach(() => {
  mockCreateSession.mockReset().mockResolvedValue({ id: 'cs_test_mocked', url: 'https://example.test/checkout' });
});

it('passes an explicit learning-session expiry to Stripe in Unix seconds', async () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 31 * 60;
  await expect(createStripeCheckoutSession({ ...checkout, expiresAt })).resolves.toEqual({
    stripeSessionId: 'cs_test_mocked', checkoutUrl: 'https://example.test/checkout',
  });
  expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({
    expires_at: expiresAt, client_reference_id: checkout.externalOrderId,
    line_items: [{ price_data: { currency: 'eur', product_data: { name: checkout.productName }, unit_amount: 3500 }, quantity: 1 }],
  }));
});

it('preserves Stripe default expiry when the checkout does not request a shorter lifetime', async () => {
  await createStripeCheckoutSession(checkout);
  expect(mockCreateSession).toHaveBeenCalledTimes(1);
  expect(mockCreateSession.mock.calls[0][0]).not.toHaveProperty('expires_at');
});
