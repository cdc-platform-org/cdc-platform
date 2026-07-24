import { z } from 'zod';
export const rejectUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export const banUserSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export const setAdminRoleSchema = z.object({
  adminRole: z.enum(['SUPER_ADMIN', 'MANAGER', 'MODERATOR']).nullable(),
});
export const addTeamMemberSchema = z.object({
  email: z.string().email(),
  adminRole: z.enum(['SUPER_ADMIN', 'MANAGER', 'MODERATOR']),
});
export const moderateListingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export const updateBogSettingsSchema = z.object({
  clientId: z.string().trim().max(200).optional(),
  secretKey: z.string().trim().max(500).optional(),
  isLiveMode: z.boolean().optional(),
});
