import { z } from 'zod';

export const checkoutMentorshipSchema = z.object({
  mentorId: z.string().uuid(),
  // Minor currency units (cents/tetri) — e.g. 5000 = 50.00 GEL. Matches the
  // convention used by Gig.budgetAmount / GigApplication.bidAmount.
  amount: z.number().int().positive(),
  currency: z.enum(['GEL', 'USD', 'EUR', 'GBP']).default('GEL'),
  note: z.string().trim().max(500).optional(),
});
