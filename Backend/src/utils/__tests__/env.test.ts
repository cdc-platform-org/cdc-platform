import { assertStripeKeyModeIsSafe } from '../env';

describe('assertStripeKeyModeIsSafe', () => {
  it('rejects a test-mode key (sk_test_...) in production', () => {
    expect(() => assertStripeKeyModeIsSafe('sk_test_abc123', 'production')).toThrow(/test-mode key/i);
  });

  it('accepts a live-mode key (sk_live_...) in production', () => {
    expect(() => assertStripeKeyModeIsSafe('sk_live_abc123', 'production')).not.toThrow();
  });

  it('rejects an unrecognized/unexpected Stripe secret-key prefix in production', () => {
    expect(() => assertStripeKeyModeIsSafe('rk_live_abc123', 'production')).toThrow(/does not look like a recognized/i);
  });

  it('does not throw when the key is unset in production — "not configured yet" is a valid state', () => {
    expect(() => assertStripeKeyModeIsSafe('', 'production')).not.toThrow();
  });

  it('accepts a test-mode key in development/test without requiring real credentials', () => {
    expect(() => assertStripeKeyModeIsSafe('sk_test_abc123', 'test')).not.toThrow();
    expect(() => assertStripeKeyModeIsSafe('sk_test_abc123', 'development')).not.toThrow();
    expect(() => assertStripeKeyModeIsSafe('', 'test')).not.toThrow();
  });

  it('warns but does not throw for a live-mode key outside production', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => assertStripeKeyModeIsSafe('sk_live_abc123', 'development')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('never includes the secret key value in a thrown error message or a warning', () => {
    const rejectedSecret = 'sk_test_SUPER-SECRET-VALUE-zzz999';
    let thrown: Error | undefined;
    try {
      assertStripeKeyModeIsSafe(rejectedSecret, 'production');
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown!.message).not.toContain(rejectedSecret);
    expect(thrown!.message).not.toContain('SUPER-SECRET-VALUE');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const warnedSecret = 'sk_live_ANOTHER-SECRET-999';
    assertStripeKeyModeIsSafe(warnedSecret, 'development');
    expect(warnSpy).toHaveBeenCalled();
    const warnedWith = warnSpy.mock.calls.map((call) => call.join(' ')).join(' ');
    expect(warnedWith).not.toContain(warnedSecret);
    expect(warnedWith).not.toContain('ANOTHER-SECRET-999');
    warnSpy.mockRestore();
  });
});

// Proves the guard is actually wired into env.ts's module-load path, not
// just defined and never called — reloads the module fresh with a
// controlled NODE_ENV/STRIPE_SECRET_KEY, same jest.resetModules()+require()
// pattern paymentGatewayService.test.ts already uses for this exact reason
// (env.ts's own top-level requireEnv() calls only run once per module
// instance, so re-checking its startup behavior needs a fresh instance).
describe('env.ts module load — Stripe production-key guard wiring', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.STRIPE_SECRET_KEY = originalStripeKey;
    jest.resetModules();
  });

  it('refuses to load when NODE_ENV=production and STRIPE_SECRET_KEY is a test key', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_test_should_be_rejected_at_startup';
    expect(() => require('../env')).toThrow(/test-mode key/i);
  });

  it('loads cleanly when NODE_ENV=production and STRIPE_SECRET_KEY is a live key', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_live_should_be_accepted_at_startup';
    expect(() => require('../env')).not.toThrow();
  });

  it('loads cleanly in test/development with no Stripe key configured — no real credentials required', () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    process.env.STRIPE_SECRET_KEY = '';
    expect(() => require('../env')).not.toThrow();
  });
});
