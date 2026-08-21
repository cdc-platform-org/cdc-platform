import { z } from 'zod';

export const updateCommissionPercentageSchema = z.object({
  commissionPercentage: z.number().min(0).max(100),
});

export const updateDailyPostLimitSchema = z.object({
  dailyPostLimit: z.number().int().min(1),
});
