import { z } from 'zod';

export const blogPostCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(500),
  category: z.string().min(2).max(100),
  content: z.string().min(20),
  // English twins — optional, nullable to allow clearing a previously
  // auto-translated value. Public pages fall back to the Georgian fields
  // when these are unset (see routes/blog.ts and pages/blog).
  titleEn: z.string().min(3).max(200).optional().nullable(),
  descriptionEn: z.string().min(10).max(500).optional().nullable(),
  contentEn: z.string().min(20).optional().nullable(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  published: z.boolean().optional().default(true),
});

export const blogPostUpdateSchema = blogPostCreateSchema.partial();
