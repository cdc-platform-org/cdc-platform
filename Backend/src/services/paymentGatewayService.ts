// ============================================================
// Payment gateway abstraction for card-on-file billing (trial card binding,
// $0 verification holds, future recurring charges). Same posture as
// BogSettings/agentBillingService's existing "Non-Invasive Pause" comment:
// the data model and call sites are real, but nothing here calls out to an
// actual card network yet. STUB is the only provider implemented — it
// deterministically "succeeds" every bind, matching how a real gateway's
// $0 auth hold would behave for a valid card, without ever touching a real
// processor. Swapping in BOG or another real processor later means adding a
// second branch here; every caller already goes through this interface.
// ============================================================

export interface BindCardParams {
  // Opaque token the frontend's gateway SDK produced client-side (Stripe
  // Elements / BOG's own tokenization widget, once wired) — this service
  // never sees or stores a raw PAN, same PCI-scope-avoidance posture as the
  // existing PaymentMethod.processorToken field.
  processorToken: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface BindCardResult {
  verified: boolean;
  verifiedAt: Date | null;
}

export class PaymentGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentGatewayError';
  }
}

// $0 authorization hold to prove the card is live before a trial starts.
// The STUB provider treats a syntactically-plausible token as an
// immediately-verified card — no network call, no real hold placed.
export async function bindCard(params: BindCardParams): Promise<BindCardResult> {
  if (!params.processorToken.trim()) {
    throw new PaymentGatewayError('Missing card token from the payment form.');
  }
  if (!/^\d{2}$/.test(String(params.expiryMonth).padStart(2, '0')) || params.expiryMonth < 1 || params.expiryMonth > 12) {
    throw new PaymentGatewayError('Invalid card expiry month.');
  }
  const now = new Date();
  const expiry = new Date(params.expiryYear, params.expiryMonth, 0, 23, 59, 59);
  if (expiry < now) {
    throw new PaymentGatewayError('This card has expired.');
  }
  return { verified: true, verifiedAt: new Date() };
}

// Placeholder for the deferred real-charge phase (see agentBillingService's
// own comment) — intentionally unimplemented. Nothing in this codebase
// calls this yet; it exists so callers can be written against the final
// shape without a second interface change later.
export async function chargeCard(_paymentMethodId: string, _amountTetri: number): Promise<never> {
  throw new PaymentGatewayError('Real card charging is not implemented yet — no payment gateway is wired up.');
}
