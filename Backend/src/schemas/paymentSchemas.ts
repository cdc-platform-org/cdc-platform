import { z } from 'zod';

export const checkoutMentorshipSchema = z.object({
  mentorId: z.string().uuid(),
  // No amount/currency here on purpose — the charge is always the mentor's
  // own mentorHourlyRate, looked up server-side in routes/payments.ts, the
  // same "never trust a client-supplied price" posture course checkout
  // already had. A client-supplied price previously let a tampered request
  // book any mentor session at any amount.
  note: z.string().trim().max(500).optional(),
  // ISO datetime string — re-validated server-side against the mentor's
  // MentorAvailabilityRules (see mentorAvailabilityService.ts) regardless of
  // what slot the client displayed as "available".
  scheduledAt: z.string().datetime(),
  studentPhone: z.string().trim().min(5).max(30),
  consultationDescription: z.string().trim().max(2000).optional(),
});
