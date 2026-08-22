// paymentGatewayService.bindCard's STUB provider is a same-session
// regression target: it was reachable by ANY authenticated user via any
// non-"pm_" token even with Stripe fully configured, defeating the
// "verified card required to start a trial" gate (see billingService's
// startTrialSubscription). The fix gates STUB behind STRIPE_SECRET_KEY
// being unset. STRIPE_SECRET_KEY is a module-level const computed at
// import time from utils/env.ts, so each case below resets the module
// registry and sets process.env before re-requiring, rather than mocking
// the constant directly. No real Stripe network call is made in either
// branch below: a non-"pm_" token never reaches stripePaymentService.

const user = { id: 'test-user', email: 'test@cdc.test', name: 'Test User' };

const validCardParams = {
  processorToken: 'not-a-stripe-token',
  brand: 'visa',
  last4: '4242',
  expiryMonth: 12,
  expiryYear: new Date().getFullYear() + 3,
};

describe('paymentGatewayService.bindCard — STUB bypass gate', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('falls back to STUB (verified:true, no network call) when STRIPE_SECRET_KEY is unset', async () => {
    process.env.STRIPE_SECRET_KEY = ''; // set (not deleted) so dotenv.config() won't repopulate it from Backend/.env
    const { bindCard } = require('../paymentGatewayService');

    const result = await bindCard(validCardParams, user);
    expect(result.provider).toBe('STUB');
    expect(result.verified).toBe(true);
  });

  it('rejects a non-Stripe token instead of falling back to STUB once STRIPE_SECRET_KEY is configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_gate_test';
    const { bindCard, PaymentGatewayError } = require('../paymentGatewayService');

    await expect(bindCard(validCardParams, user)).rejects.toThrow(PaymentGatewayError);
    await expect(bindCard(validCardParams, user)).rejects.toThrow('does not look like a valid card token');
  });

  it('rejects an expired card regardless of provider configuration', async () => {
    process.env.STRIPE_SECRET_KEY = '';
    const { bindCard, PaymentGatewayError } = require('../paymentGatewayService');

    await expect(
      bindCard({ ...validCardParams, expiryMonth: 1, expiryYear: 2020 }, user)
    ).rejects.toThrow(PaymentGatewayError);
  });
});
