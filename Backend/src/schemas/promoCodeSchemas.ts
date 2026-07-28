import { z } from 'zod';

export const createPromoCodeSchema = z
  .object({
    code: z.string().trim().min(3).max(40).toUpperCase(),
    discountPercent: z.number().int().min(1).max(100).optional().nullable(),
    discountAmount: z.number().int().positive().optional().nullable(), // minor units
    expiresAt: z.string().datetime().optional().nullable(),
    maxUses: z.number().int().positive().optional().nullable(),
  })
  .refine((data) => !!data.discountPercent !== !!data.discountAmount, {
    message: 'Set exactly one of discountPercent or discountAmount, not both.',
    path: ['discountPercent'],
  });

export const updatePromoCodeSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
});
