import { z } from 'zod';

export const createProductReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int('Rating must be a whole number of stars.').min(1).max(5),
  comment: z.string().trim().min(10, 'Comment must be at least 10 characters.').max(2000),
  imageUrl: z.string().url().optional().nullable(),
});
