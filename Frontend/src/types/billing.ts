export type PaymentProvider = 'STUB' | 'BOG' | 'STRIPE';

export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  processorToken: string;
  // Stripe's own lowercase brand string ("visa", "mastercard", "amex",
  // "discover", "diners", "jcb", "unionpay", "unknown") — never a closed
  // union here, so an unrecognized value still renders (capitalized) rather
  // than needing a type update every time a new network shows up.
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  // Null means the $0 verification hold never completed — shouldn't happen
  // for a card that made it into this list (bindCard only creates verified
  // rows), kept nullable to match the DB column honestly.
  verifiedAt: string | null;
  createdAt: string;
}

// What POST /billing/payment-methods actually needs — brand/last4/expiry
// come straight from Stripe.js's PaymentMethod object after tokenization,
// not typed in by the user.
export interface AddPaymentMethodPayload {
  processorToken: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  setDefault?: boolean;
  // The confirmed SetupIntent's id — required for a real Stripe card (the
  // backend uses it to verify the $0 hold actually succeeded, not just that
  // the PaymentMethod exists). See PaymentMethodsCard.tsx's handleAddCard.
  setupIntentId?: string;
}

// Mirrors Backend's CardRemovalRequiresConfirmationError (409) body —
// thrown when deleting this card would silently turn off auto-renew on a
// live subscription.
export interface CardRemovalConfirmationRequired {
  message: string;
  details: { affectedSubscriptions: { id: string; productType: BillingProductType; referenceId: string }[] };
}

export type InvoiceStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  amount: number; // თეთრებში/ცენტებში (ინტეჯერი)
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  pdfDownloadUrl: string | null;
}

export interface BillingHistory {
  invoices: Invoice[];
  totalCount: number;
}

// ============================================================
// Unified SaaS billing engine (BillingSubscription/UsageRecord on the
// backend) — distinct from the generic Invoice/BillingHistory types above,
// which predate this feature and aren't wired to a real backend contract
// yet. base fee/usage are in tetri (minor units), same convention as
// PaymentMethod above.
// ============================================================

export type BillingProductType = 'AI_AGENT_SUITE';
export type BillingSubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

export interface BillingSubscription {
  id: string;
  businessId: string;
  productType: BillingProductType;
  referenceId: string;
  status: BillingSubscriptionStatus;
  baseFeeTetri: number;
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  paymentMethodId: string | null;
  paymentMethod: { brand: string; last4: string } | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  currentCycleUsageTetri: number;
}

export interface BillingSettings {
  baseFeeTetri: number;
  marginMultiplier: number;
  trialDays: number;
}