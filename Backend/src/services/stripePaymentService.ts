import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../utils/env';

// ============================================================
// Stripe Checkout client — the international-currency counterpart to
// bogPaymentService.ts. BOG stays the gateway for Georgian (GEL) users;
// Stripe Checkout handles USD/EUR for everyone else (see routes/
// stripePayments.ts, mirrors routes/payments.ts's four checkout flows).
// Docs: https://docs.stripe.com/api/checkout/sessions
// ============================================================

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe payment gateway is not configured. Set STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET for the webhook).');
    this.name = 'StripeNotConfiguredError';
  }
}

let cachedClient: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY) throw new StripeNotConfiguredError();
  if (!cachedClient) {
    cachedClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return cachedClient;
}

export interface CreateStripeCheckoutSessionParams {
  externalOrderId: string;
  // Minor currency units (cents), same convention as CreateBogOrderParams.amount
  // and every other Int money field in this codebase (Gig.budgetAmount,
  // BogPayment.amount, etc.) — Stripe's own `unit_amount` is already
  // minor-units, so no conversion happens here (unlike BOG, which wants a
  // major-unit decimal).
  amount: number;
  currency: 'usd' | 'eur';
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface CreateStripeCheckoutSessionResult {
  stripeSessionId: string;
  checkoutUrl: string;
}

export async function createStripeCheckoutSession(
  params: CreateStripeCheckoutSessionParams
): Promise<CreateStripeCheckoutSessionResult> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    // Apple Pay / Google Pay surface automatically for the 'card' payment
    // method type on supported browsers/devices — no separate opt-in needed.
    line_items: [
      {
        price_data: {
          currency: params.currency,
          product_data: { name: params.productName },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    client_reference_id: params.externalOrderId,
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
  if (!session.url) {
    throw new Error('Stripe Checkout session created without a redirect URL.');
  }
  return { stripeSessionId: session.id, checkoutUrl: session.url };
}

export async function getStripeCheckoutSession(stripeSessionId: string): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(stripeSessionId);
}

// ============================================================
// Card-on-file vault — real Stripe tokenization for billingService.ts's
// PaymentMethod model, distinct from the one-off Checkout flow above. A
// Customer is required for a saved card to be reusable for a future charge
// at all (Stripe's SetupIntent/PaymentMethod attach model is Customer-
// scoped); createStripeCardSetupIntent/verifyAndAttachStripePaymentMethod
// are the two calls paymentGatewayService.bindCard needs.
// Docs: https://docs.stripe.com/payments/save-and-reuse
// ============================================================

// Lazily creates exactly one Stripe Customer per platform user (User.
// stripeCustomerId), reused on every later card add — never creates a
// second Customer for someone who already has one, even if called again.
export async function getOrCreateStripeCustomerId(userId: string, email: string, name: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({ email, name, metadata: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

// A SetupIntent is Stripe's mechanism for verifying + saving a card with no
// immediate charge — exactly the "$0 verification hold" behavior
// PaymentMethod.verifiedAt already documents. The frontend confirms this
// client-side with Stripe.js/Elements, which is what keeps raw card data
// off this server entirely (PCI SAQ-A scope, not SAQ-D).
export async function createStripeCardSetupIntent(customerId: string): Promise<string> {
  const stripe = getStripeClient();
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });
  if (!setupIntent.client_secret) {
    throw new Error('Stripe SetupIntent created without a client secret.');
  }
  return setupIntent.client_secret;
}

export class StripePaymentMethodInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripePaymentMethodInvalidError';
  }
}

// The actual server-side verification step — and the thing that makes the
// "$0 verification hold" in PaymentMethod.verifiedAt's own comment true
// rather than aspirational. Retrieving a PaymentMethod by id only proves it
// *exists*; it proves nothing about whether the cardholder's bank actually
// approved anything. Retrieving the *SetupIntent* and checking its status
// is what proves the $0 hold genuinely succeeded — a card that fails that
// check (declined, requires further action, or never confirmed at all)
// never reaches here as `succeeded`. The three checks below close a real
// gap a plain PaymentMethod-id-only version would have: a client could
// otherwise call stripe.createPaymentMethod() for a syntactically-valid
// card and skip confirmCardSetup entirely, and this would have no way to
// tell that apart from the real thing.
export async function verifyStripeCardSetup(
  setupIntentId: string,
  paymentMethodId: string,
  customerId: string
): Promise<{ brand: string; last4: string; expiryMonth: number; expiryYear: number }> {
  const stripe = getStripeClient();
  let setupIntent: Stripe.SetupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] });
  } catch {
    throw new StripePaymentMethodInvalidError('This card could not be verified with Stripe. Please try again.');
  }

  if (setupIntent.status !== 'succeeded') {
    throw new StripePaymentMethodInvalidError('This card was not successfully verified. Please try again.');
  }
  // Both are tamper guards against a client sending a real-but-mismatched
  // setupIntentId/paymentMethodId/customer combination it doesn't actually
  // own — e.g. IDs that succeeded for a different user entirely.
  if (setupIntent.customer !== customerId) {
    throw new StripePaymentMethodInvalidError('This verification does not belong to your account.');
  }
  const confirmedPaymentMethodId =
    typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id;
  if (confirmedPaymentMethodId !== paymentMethodId) {
    throw new StripePaymentMethodInvalidError('This card does not match the verification that was completed.');
  }

  const paymentMethod =
    typeof setupIntent.payment_method === 'string'
      ? await stripe.paymentMethods.retrieve(paymentMethodId)
      : setupIntent.payment_method;
  if (!paymentMethod || !paymentMethod.card) {
    throw new StripePaymentMethodInvalidError('Only card payment methods can be saved.');
  }

  // A SetupIntent created with a customer (see createStripeCardSetupIntent)
  // already attaches its payment method to that customer automatically on
  // success — this is a defensive no-op in the normal case, only doing real
  // work if that ever isn't true.
  if (paymentMethod.customer !== customerId) {
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch {
      throw new StripePaymentMethodInvalidError('This card could not be saved to your account. Please try again.');
    }
  }

  return {
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expiryMonth: paymentMethod.card.exp_month,
    expiryYear: paymentMethod.card.exp_year,
  };
}

// Best-effort — mirrors deleteManagedImage's posture elsewhere in this
// codebase (never let a cleanup call block or fail the caller's own
// success response). Stripe keeps a detached PaymentMethod around
// harmlessly; this just stops it from being chargeable/visible on the
// Customer going forward.
export async function detachStripePaymentMethod(paymentMethodId: string): Promise<void> {
  try {
    const stripe = getStripeClient();
    await stripe.paymentMethods.detach(paymentMethodId);
  } catch {
    // Already detached, already gone, or Stripe not configured — the local
    // PaymentMethod row is the source of truth for what CDC considers
    // "removed" either way.
  }
}

// Must run against the RAW bytes of the webhook request body (see server.ts's
// express.json({ verify }), which stashes req.rawBody for this exact purpose
// — already relied on by the BOG callback handler) — Stripe's own SDK
// verification, unlike BOG's hand-rolled RSA check, needs the raw body,
// the `Stripe-Signature` header, and the endpoint's signing secret.
export function constructStripeWebhookEvent(rawBody: Buffer, signatureHeader: string): Stripe.Event {
  if (!STRIPE_WEBHOOK_SECRET) throw new StripeNotConfiguredError();
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET);
}
