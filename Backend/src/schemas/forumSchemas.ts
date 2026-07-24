import { z } from 'zod';

export const createThreadSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(5).max(200),
  content: z.string().trim().min(10).max(10000),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const createCategorySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens.'),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(1).max(500),
});

export const moderateThreadSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});
