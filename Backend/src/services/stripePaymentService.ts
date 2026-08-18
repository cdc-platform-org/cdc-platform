import Stripe from 'stripe';
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
