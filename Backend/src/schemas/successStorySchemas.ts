import { z } from 'zod';

export const successStoryCreateSchema = z.object({
  studentName: z.string().trim().min(2).max(150),
  roleTitle: z.string().trim().min(2).max(150),
  roleTitleEn: z.string().trim().min(2).max(150).optional().nullable(),
  courseName: z.string().trim().min(2).max(150),
  testimonial: z.string().trim().min(10).max(1000),
  testimonialEn: z.string().trim().min(10).max(1000).optional().nullable(),
  storyContent: z.string().trim().max(20000).optional().nullable(),
  storyContentEn: z.string().trim().max(20000).optional().nullable(),
  // Set via POST /upload-avatar, then submitted back on the create/update
  // call — was missing from this schema entirely, which meant Zod silently
  // stripped it from every request and no avatar ever got persisted.
  avatarUrl: z.union([z.string().trim().url('Enter a valid URL.'), z.literal('')]).optional().nullable(),
  galleryImages: z.array(z.string().trim().url('Enter a valid URL.')).optional().default([]),
  linkedinUrl: z
    .union([z.string().trim().url('Enter a valid URL.').regex(/^https?:\/\//, 'Must start with http:// or https://'), z.literal('')])
    .optional()
    .nullable(),
  portfolioUrl: z
    .union([z.string().trim().url('Enter a valid URL.').regex(/^https?:\/\//, 'Must start with http:// or https://'), z.literal('')])
    .optional()
    .nullable(),
  hiredBy: z.string().trim().max(200).optional().nullable(),
  isFeatured: z.boolean().optional().default(true),
});

export const successStoryUpdateSchema = successStoryCreateSchema.partial();
