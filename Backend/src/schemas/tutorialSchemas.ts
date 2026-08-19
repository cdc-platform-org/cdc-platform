import { z } from 'zod';

export const tutorialCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(1000),
  category: z.string().min(2).max(100),
  videoUrl: z.string().url(),
  // English twins — optional, nullable to allow clearing a previously-set
  // value. Public pages fall back to the Georgian fields when unset (same
  // convention as BlogPost).
  titleEn: z.string().min(3).max(200).optional().nullable(),
  descriptionEn: z.string().min(10).max(1000).optional().nullable(),
  order: z.number().int().min(0).optional().default(0),
  published: z.boolean().optional().default(true),
});

export const tutorialUpdateSchema = tutorialCreateSchema.partial();
