import { PaymentProvider } from '@prisma/client';
import { getOrCreateStripeCustomerId, verifyStripeCardSetup, StripePaymentMethodInvalidError } from './stripePaymentService';
import { STRIPE_SECRET_KEY } from '../utils/env';

// ============================================================
// Payment gateway abstraction for card-on-file billing (trial card binding,
// $0 verification holds, future recurring charges). Two providers are real:
// STRIPE (verifies + attaches an actual Stripe PaymentMethod, see
// stripePaymentService.ts) and STUB (deterministically "succeeds" every
// syntactically-plausible bind, for local/dev use or a future BOG-hosted
// binding widget that isn't wired up yet — no BOG card-vaulting API
// integration exists in this codebase). Every caller already goes through
// this interface, so adding a real BOG branch later is a third case here,
// not a call-site change.
// ============================================================

export interface BindCardParams {
  // Opaque token the frontend's gateway SDK produced client-side. For
  // Stripe this is a real PaymentMethod id ("pm_...") from Stripe.js/
  // Elements — this service never sees or stores a raw PAN, same PCI-
  // scope-avoidance posture as the existing PaymentMethod.processorToken
  // field. A token that doesn't look like a Stripe PaymentMethod id falls
  // back to the STUB provider (see bindCard below).
  processorToken: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  // The SetupIntent id from stripe.confirmCardSetup() client-side — required
  // whenever processorToken is a real Stripe PaymentMethod id (see bindCard).
  // Proves the $0 hold actually succeeded, not just that the PaymentMethod
  // itself exists.
  setupIntentId?: string;
}

export interface BindCardResult {
  verified: boolean;
  verifiedAt: Date | null;
  provider: PaymentProvider;
  // Only set (and only trustworthy) for STRIPE — re-derived from Stripe's
  // own API response in bindCard, overriding whatever the client sent for
  // these display fields.
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export class PaymentGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

function validateExpiry(expiryMonth: number, expiryYear: number): void {
  if (expiryMonth < 1 || expiryMonth > 12) {
    throw new PaymentGatewayError('Invalid card expiry month.');
  }
  const now = new Date();
  const expiry = new Date(expiryYear, expiryMonth, 0, 23, 59, 59);
  if (expiry < now) {
    throw new PaymentGatewayError('This card has expired.');
  }
}

// $0 authorization hold to prove the card is live before a trial starts.
// STRIPE tokens (a real "pm_..." id from Stripe.js) are verified against
// Stripe's own API and attached to the user's Stripe Customer — a genuine
// network round trip, not a format check. Anything else falls back to the
// STUB provider, which treats a syntactically-plausible token as an
// immediately-verified card with no network call and no real hold placed.
export async function bindCard(
  params: BindCardParams,
  user: { id: string; email: string; name: string }
): Promise<BindCardResult> {
  if (!params.processorToken.trim()) {
    throw new PaymentGatewayError('Missing card token from the payment form.');
  }
  validateExpiry(params.expiryMonth, params.expiryYear);

  if (params.processorToken.startsWith('pm_')) {
    if (!params.setupIntentId) {
      throw new PaymentGatewayError('Missing card verification. Please try adding the card again.');
    }
    const customerId = await getOrCreateStripeCustomerId(user.id, user.email, user.name);
    try {
      const card = await verifyStripeCardSetup(params.setupIntentId, params.processorToken, customerId);
      return { verified: true, verifiedAt: new Date(), provider: 'STRIPE', ...card };
    } catch (err) {
      if (err instanceof StripePaymentMethodInvalidError) {
        throw new PaymentGatewayError(err.message);
      }
      throw err;
    }
  }

  // The STUB fallback below is for local/dev use before a real gateway is
  // wired up — it must NEVER be reachable once Stripe actually is
  // configured, or any authenticated user could POST an arbitrary
  // non-"pm_" token straight to /billing/payment-methods and get back an
  // instantly-"verified: true" card with zero real verification, no
  // network call, and a client-supplied brand/last4 — satisfying
  // startTrialSubscription's "verified payment method required" gate with
  // a card that was never actually checked against anything.
  if (STRIPE_SECRET_KEY) {
    throw new PaymentGatewayError('This does not look like a valid card token. Please try adding the card again.');
  }

  return {
    verified: true,
    verifiedAt: new Date(),
    provider: 'STUB',
    brand: params.brand,
    last4: params.last4,
    expiryMonth: params.expiryMonth,
    expiryYear: params.expiryYear,
  };
}

// Placeholder for the deferred real-charge phase (see agentBillingService's
// own comment) — intentionally unimplemented. Nothing in this codebase
// calls this yet; it exists so callers can be written against the final
// shape without a second interface change later.
export async function chargeCard(_paymentMethodId: string, _amountTetri: number): Promise<never> {
  throw new PaymentGatewayError('Real card charging is not implemented yet — no payment gateway is wired up.');
}
