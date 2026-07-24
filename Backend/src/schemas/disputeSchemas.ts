import { z } from 'zod';

export const openDisputeSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(['RESOLVED_REFUND', 'RESOLVED_PAYOUT', 'DISMISSED']),
  resolution: z.string().trim().max(2000).optional(),
});
