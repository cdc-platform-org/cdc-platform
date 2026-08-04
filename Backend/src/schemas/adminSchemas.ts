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
export const mentorAvailabilityRuleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((data) => data.endMinute > data.startMinute, {
    message: 'endMinute must be after startMinute.',
    path: ['endMinute'],
  });
export const manualCertificateSchema = z.object({
  studentNameKa: z.string().trim().min(2).max(200),
  studentNameEn: z.string().trim().max(200).optional(),
  studentEmail: z.string().trim().email(),
  courseTitleKa: z.string().trim().min(2).max(300),
  courseTitleEn: z.string().trim().max(300).optional(),
  instructorName: z.string().trim().min(2).max(200),
  // ISO date string — deliberately z.string().datetime() with no minimum, so
  // past dates (retroactive issuance) are always valid.
  issueDate: z.string().datetime(),
});
