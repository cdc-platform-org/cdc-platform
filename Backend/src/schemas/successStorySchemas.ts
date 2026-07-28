import { z } from 'zod';

export const successStoryCreateSchema = z.object({
  studentName: z.string().trim().min(2).max(150),
  roleTitle: z.string().trim().min(2).max(150),
  courseName: z.string().trim().min(2).max(150),
  testimonial: z.string().trim().min(10).max(1000),
  // Set via POST /upload-avatar, then submitted back on the create/update
  // call — was missing from this schema entirely, which meant Zod silently
  // stripped it from every request and no avatar ever got persisted.
  avatarUrl: z.union([z.string().trim().url('Enter a valid URL.'), z.literal('')]).optional().nullable(),
  linkedinUrl: z
    .union([z.string().trim().url('Enter a valid URL.').regex(/^https?:\/\//, 'Must start with http:// or https://'), z.literal('')])
    .optional()
    .nullable(),
  isFeatured: z.boolean().optional().default(true),
});

export const successStoryUpdateSchema = successStoryCreateSchema.partial();
