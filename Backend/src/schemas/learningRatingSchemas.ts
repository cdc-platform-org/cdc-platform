import { z } from 'zod';

export const learningRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).nullish(),
});
