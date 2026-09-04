import { z } from 'zod';

const applicableTypeSchema = z.enum(['ALL', 'COURSE', 'LIVE_TRAINING', 'DIGITAL_PRODUCT', 'AI_TOOL']);

export const createPromoCodeSchema = z
  .object({
    code: z.string().trim().min(3).max(40).toUpperCase(),
    discountPercent: z.number().int().min(1).max(100).optional().nullable(),
    discountAmount: z.number().int().positive().optional().nullable(), // minor units
    applicableType: applicableTypeSchema.default('ALL'),
    applicableTargetIds: z.array(z.string().trim().min(1)).default([]),
    isActive: z.boolean().default(true),
    expiresAt: z.string().datetime().optional().nullable(),
    maxUses: z.number().int().positive().optional().nullable(),
  })
  .refine((data) => !!data.discountPercent !== !!data.discountAmount, {
    message: 'Set exactly one of discountPercent or discountAmount, not both.',
    path: ['discountPercent'],
  })
  .refine((data) => data.applicableType === 'ALL' || data.applicableTargetIds.length > 0, {
    message: 'Select at least one target when restricting a code to a specific type.',
    path: ['applicableTargetIds'],
  });

export const updatePromoCodeSchema = z.object({
  discountPercent: z.number().int().min(1).max(100).optional().nullable(),
  discountAmount: z.number().int().positive().optional().nullable(),
  applicableType: applicableTypeSchema.optional(),
  applicableTargetIds: z.array(z.string().trim().min(1)).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
});
