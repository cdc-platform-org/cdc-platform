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
// AI Agents Suite trial extension (PATCH /api/admin/users/:id/ai-trial) —
// discriminated on `mode` so each shape only carries the field it needs:
// "extend" adds N days on top of whichever is later (now, or the current
// expiry — so extending an already-active trial stacks, but extending an
// expired one starts fresh from today, not from a stale past date);
// "set" pins an exact expiry (the admin's date picker); "unlimited" flips
// the account to aiSubscriptionActive instead of a fake far-future date.
export const updateAiTrialSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('extend'), days: z.number().int().positive().max(3650) }),
  z.object({ mode: z.literal('set'), date: z.string().datetime() }),
  z.object({ mode: z.literal('unlimited') }),
]);

// Recording links are pasted, not uploaded through us — Google Drive,
// Bunny CDN, a direct MP4, an "Awesome Screen Recorder" share link, etc.
// — so this only validates it's a well-formed URL, nothing provider-specific.
export const attachRecordingSchema = z.object({
  // z.string().url() alone accepts any syntactically valid URL scheme,
  // including "javascript:" — harmless as stored data, but this value gets
  // rendered straight into an <a href> on both the admin panel and the
  // student/mentor dashboard, so the scheme itself must be constrained to
  // what a link is ever legitimately allowed to be.
  recordingUrl: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((url) => /^https?:\/\//i.test(url), { message: 'Recording URL must start with http:// or https://.' }),
});

export const updateBogSettingsSchema = z.object({
  clientId: z.string().trim().max(200).optional(),
  secretKey: z.string().trim().max(500).optional(),
  isLiveMode: z.boolean().optional(),
});
export const mentorProfileSchema = z.object({
  mentorTitle: z.string().trim().max(200).optional(),
  // Minor units (tetri) — same convention as Course.originalPrice.
  mentorHourlyRate: z.number().int().min(0).optional(),
  mentorSkills: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  bio: z.string().trim().max(1000).optional(),
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
