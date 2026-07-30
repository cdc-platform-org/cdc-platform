import { z } from 'zod';

export const studioCaseCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  clientName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(5).max(2000),
  fullStory: z.string().trim().max(20000).optional().nullable(),
  // Set via POST /upload-image, then submitted back on the create/update call.
  coverImageUrl: z.union([z.string().trim().url('Enter a valid URL.'), z.literal('')]).optional().nullable(),
  galleryImages: z.array(z.string().trim().url('Enter a valid URL.')).optional().default([]),
  projectUrl: z
    .union([z.string().trim().url('Enter a valid URL.').regex(/^https?:\/\//, 'Must start with http:// or https://'), z.literal('')])
    .optional()
    .nullable(),
  isFeatured: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
});

export const studioCaseUpdateSchema = studioCaseCreateSchema.partial();
