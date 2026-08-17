export interface PaymentMethod {
  id: string;
  processorToken: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'other';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
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