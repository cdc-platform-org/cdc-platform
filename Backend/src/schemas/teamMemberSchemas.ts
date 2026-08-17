import { z } from 'zod';

export const teamMemberCreateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  role: z.string().trim().min(2).max(150),
  bio: z.string().trim().max(2000).optional().nullable(),
  nameEn: z.string().trim().max(150).optional().nullable(),
  roleEn: z.string().trim().max(150).optional().nullable(),
  bioEn: z.string().trim().max(2000).optional().nullable(),
  // Set via POST /upload-photo, then submitted back on the create/update call —
  // same two-step flow as SuccessStory's avatarUrl.
  imageUrl: z.union([z.string().trim().url('Enter a valid URL.'), z.literal('')]).optional().nullable(),
  type: z.enum(['MANAGEMENT', 'TRAINER']).optional().default('MANAGEMENT'),
  order: z.number().int().optional().default(0),
  active: z.boolean().optional().default(true),
});

export const teamMemberUpdateSchema = teamMemberCreateSchema.partial();
