import { z } from 'zod';

// processorToken is opaque — produced client-side by whichever gateway SDK
// is wired up (see paymentGatewayService.ts) — this backend never sees a
// raw card number, so no PAN/CVV fields exist here on purpose.
export const addPaymentMethodSchema = z.object({
  processorToken: z.string().trim().min(1).max(500),
  brand: z.string().trim().min(1).max(30),
  last4: z.string().trim().regex(/^\d{4}$/),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(new Date().getFullYear()),
  setDefault: z.boolean().optional(),
  // Required in practice whenever processorToken is a real Stripe
  // PaymentMethod id — enforced in paymentGatewayService.bindCard, not
  // here, since the STUB provider's tokens never have one.
  setupIntentId: z.string().trim().min(1).max(500).optional(),
});

export const removePaymentMethodSchema = z.object({
  confirmCancelAutoRenew: z.boolean().optional(),
});

export const startTrialSchema = z.object({
  productType: z.enum(['AI_AGENT_SUITE', 'AI_EXAM_PROCTORING']),
  referenceId: z.string().uuid(),
});

export const autoRenewSchema = z.object({
  autoRenew: z.boolean(),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const updateBillingSettingsSchema = z.object({
  baseFeeTetri: z.number().int().positive().optional(),
  marginMultiplier: z.number().positive().optional(),
  trialDays: z.number().int().positive().max(90).optional(),
  // Manual bank-transfer alternative — undefined (field omitted) leaves the
  // stored value untouched; null or "" clears it back to "not configured"
  // (see adminFinance.ts's PUT handler, which normalizes "" to null before
  // writing — Prisma treats an explicit null in `data` as "set to null"
  // and an absent key as "don't touch", so that distinction has to survive
  // past this schema).
  bankTransferIban: z.string().trim().max(50).nullable().optional(),
  bankTransferBankName: z.string().trim().max(120).nullable().optional(),
  bankTransferAccountName: z.string().trim().max(120).nullable().optional(),
});
