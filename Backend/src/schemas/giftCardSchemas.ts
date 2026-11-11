import { z } from 'zod';
import { GIFT_CARD_DESIGNS, GIFT_CARD_MAX_GEL, GIFT_CARD_MIN_GEL, GIFT_CARD_MAX_SCHEDULE_DAYS, COMPLIMENTARY_GIFT_CARD_MAX_GEL } from '../services/giftCardService';

// Single-line text: no control characters / newlines (these go into an
// email subject line).
const oneLine = (max: number) => z.string().trim().min(1).max(max).refine((v) => !/[\u0000-\u001f\u007f]/.test(v), 'Invalid characters.');

export const checkoutGiftCardSchema = z
  .object({
    amountGel: z
      .number()
      .min(GIFT_CARD_MIN_GEL, `მინიმალური თანხაა ${GIFT_CARD_MIN_GEL} ₾.`)
      .max(GIFT_CARD_MAX_GEL, `მაქსიმალური თანხაა ${GIFT_CARD_MAX_GEL} ₾.`)
      .refine((v) => Math.round(v * 100) === v * 100, 'Invalid amount.'),
    senderName: oneLine(60),
    recipientName: oneLine(60),
    recipientEmail: z.string().trim().toLowerCase().email('ელფოსტა არასწორია.').max(200).optional().nullable(),
    message: z.string().trim().max(500).optional().nullable(),
    design: z.enum(GIFT_CARD_DESIGNS).default('classic'),
    // ISO date-time; omitted / past = send right after payment.
    deliverAt: z
      .string()
      .datetime({ offset: true })
      .optional()
      .nullable()
      .refine((v) => !v || new Date(v).getTime() <= Date.now() + GIFT_CARD_MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000, 'გაგზავნის თარიღი ერთ წელზე შორს ვერ იქნება.'),
    suggestedItem: oneLine(150).optional().nullable(),
    // Same-site path only (shown as a button in the email).
    suggestedUrl: z
      .string()
      .trim()
      .max(300)
      .regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/, 'Invalid link.')
      .optional()
      .nullable(),
  });

export const resendGiftCardSchema = z.object({
  recipientEmail: z.string().trim().toLowerCase().email('ელფოსტა არასწორია.').max(200).optional().nullable(),
});

// Admin: issue a free gift card to a person or an organization.
export const issueComplimentaryGiftCardSchema = z.object({
  amountGel: z
    .number()
    .min(1, 'მინიმალური თანხაა 1 ₾.')
    .max(COMPLIMENTARY_GIFT_CARD_MAX_GEL, `მაქსიმალური თანხაა ${COMPLIMENTARY_GIFT_CARD_MAX_GEL} ₾.`)
    .refine((v) => Math.round(v * 100) === v * 100, 'Invalid amount.'),
  senderName: oneLine(60).default('CDC'),
  recipientName: oneLine(120),
  recipientType: z.enum(['PERSON', 'ORGANIZATION']).default('PERSON'),
  recipientEmail: z.string().trim().toLowerCase().email('ელფოსტა არასწორია.').max(200).optional().nullable(),
  message: z.string().trim().max(500).optional().nullable(),
  design: z.enum(GIFT_CARD_DESIGNS).default('classic'),
  deliverAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .refine((v) => !v || new Date(v).getTime() <= Date.now() + GIFT_CARD_MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000, 'გაგზავნის თარიღი ერთ წელზე შორს ვერ იქნება.'),
});
