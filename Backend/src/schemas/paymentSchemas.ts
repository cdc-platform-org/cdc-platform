import { z } from 'zod';

export const checkoutMentorshipSchema = z.object({
  mentorId: z.string().uuid(),
  // Minor currency units (cents/tetri) — e.g. 5000 = 50.00 GEL. Matches the
  // convention used by Gig.budgetAmount / GigApplication.bidAmount.
  amount: z.number().int().positive(),
  currency: z.enum(['GEL', 'USD', 'EUR', 'GBP']).default('GEL'),
  note: z.string().trim().max(500).optional(),
  // ISO datetime string — re-validated server-side against the mentor's
  // MentorAvailabilityRules (see mentorAvailabilityService.ts) regardless of
  // what slot the client displayed as "available".
  scheduledAt: z.string().datetime(),
  studentPhone: z.string().trim().min(5).max(30),
  consultationDescription: z.string().trim().max(2000).optional(),
});
