import { z } from 'zod';

export const successStoryCreateSchema = z.object({
  studentName: z.string().trim().min(2).max(150),
  roleTitle: z.string().trim().min(2).max(150),
  courseName: z.string().trim().min(2).max(150),
  testimonial: z.string().trim().min(10).max(1000),
  linkedinUrl: z
    .union([z.string().trim().url('Enter a valid URL.').regex(/^https?:\/\//, 'Must start with http:// or https://'), z.literal('')])
    .optional()
    .nullable(),
  isFeatured: z.boolean().optional().default(true),
});

export const successStoryUpdateSchema = successStoryCreateSchema.partial();
