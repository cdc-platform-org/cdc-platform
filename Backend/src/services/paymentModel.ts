import { BogPaymentPurpose, PaymentModel } from '@prisma/client';

// Single source of truth for BogPayment.paymentModel/StripePayment.paymentModel
// — every checkout route that creates one of those rows calls this instead
// of re-deriving DIRECT/ESCROW itself, so the mapping can't drift between
// the two gateways' checkout routes (payments.ts / stripePayments.ts).
const PAYMENT_MODEL_BY_PURPOSE: Record<BogPaymentPurpose, PaymentModel> = {
  COURSE: 'DIRECT',
  PRODUCT: 'DIRECT',
  LIVE_TRAINING: 'DIRECT',
  ENGLISH_TUTOR_SUBSCRIPTION: 'DIRECT',
  MENTORSHIP: 'ESCROW',
  HR_SUPPORT: 'ESCROW',
  GIG_ESCROW_FUNDING: 'ESCROW',
};

export function paymentModelForPurpose(purpose: BogPaymentPurpose): PaymentModel {
  return PAYMENT_MODEL_BY_PURPOSE[purpose];
}
