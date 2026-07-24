import { z } from 'zod';

export const createPayoutRequestSchema = z.object({
  amount: z.number().int().min(100), // minor units — 1.00 GEL minimum
  // Optional — falls back to the student's saved payoutIban (see
  // /dashboard/settings) when omitted.
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, 'Enter a valid IBAN.')
    .optional(),
});

export const reviewPayoutRequestSchema = z.object({
  adminNote: z.string().trim().max(500).optional(),
});
