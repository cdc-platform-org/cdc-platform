import { z } from 'zod';

const nullableLimit = z.number().int().min(0).max(1_000_000).nullable();

export const iakoProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional().default(null),
  systemPrompt: z.string().trim().min(1).max(8000),
  inScope: z.string().trim().min(1).max(4000),
  outOfScope: z.string().trim().max(4000).nullable().optional().default(null),
  outOfScopeKeywords: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  visionEnabled: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(1).optional().default(0.2),
  active: z.boolean().optional().default(true),
  mentorTagline: z.string().trim().max(200).nullable().optional().default(null),
  welcomeMessageKa: z.string().trim().max(2000).nullable().optional().default(null),
  welcomeMessageEn: z.string().trim().max(2000).nullable().optional().default(null),
  defaultRequestLimit: nullableLimit.optional().default(200),
  defaultDailyRequestLimit: nullableLimit.optional().default(30),
  defaultHourlyRequestLimit: nullableLimit.optional().default(10),
  defaultScreenshotLimit: nullableLimit.optional().default(30),
  defaultMaxScreenshotsPerMessage: z.number().int().min(0).max(3).optional().default(3),
  defaultAccessDays: z.number().int().min(1).max(3650).nullable().optional().default(10),
});

// Controlled auto-top-up policy — see IakoProfileAssignment's own schema
// comment. Every field is optional and omitted entirely means "leave
// whatever is already configured alone" (same convention as `mode` below),
// so a caller that only ever sends `mode` (e.g. the Daily Guides page)
// never accidentally resets an already-configured top-up policy.
const topUpFields = {
  initialRequestLimit: nullableLimit.optional(),
  autoTopUpEnabled: z.boolean().optional(),
  autoTopUpAmount: nullableLimit.optional(),
  maxAutoTopUps: z.number().int().min(0).max(100).optional(),
  maxAutoTotal: nullableLimit.optional(),
};

export const iakoAssignmentSchema = z.object({
  profileId: z.string().uuid().nullable(),
  // Live Training assignments only — ignored for Digital Tool assignments.
  // Omitted entirely means "leave the current mode alone" on an existing
  // assignment, or "use the DB default (LIVE)" on a brand-new one; see
  // IakoProfileAssignment.mode's own schema comment for why that default
  // exists.
  mode: z.enum(['TESTING', 'LIVE']).optional(),
  ...topUpFields,
}).superRefine((data, ctx) => {
  // Internal consistency only — cross-checking maxAutoTotal against the
  // resolved starting point (initialRequestLimit ?? the profile's own
  // default) happens in the route handler, which is the only place that
  // also knows the profile's defaultRequestLimit.
  if (data.autoTopUpEnabled) {
    if (!data.autoTopUpAmount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['autoTopUpAmount'], message: 'Set a top-up amount to enable auto-top-up.' });
    if (!data.maxAutoTopUps) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxAutoTopUps'], message: 'Set how many automatic top-ups are allowed.' });
    if (data.maxAutoTotal == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maxAutoTotal'], message: 'Set the maximum automatic total.' });
  }
});

export const iakoChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  // A UUID the Frontend generates once per send attempt — see
  // iakoUsageGrantService.ts's own comment on how this makes a network
  // retry a safe no-op instead of a second charge.
  idempotencyKey: z.string().uuid(),
  guideContext: z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }, z.object({ dayId: z.string().uuid(), sectionId: z.string().min(1).max(200).optional(), itemId: z.string().min(1).max(200).optional() }).strict().optional()),
});

export const iakoUsageGrantPatchSchema = z.object({
  requestLimit: nullableLimit.optional(),
  dailyRequestLimit: nullableLimit.optional(),
  hourlyRequestLimit: nullableLimit.optional(),
  screenshotLimit: nullableLimit.optional(),
  maxScreenshotsPerMessage: z.number().int().min(0).max(3).optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export const iakoAddRequestsSchema = z.object({ amount: z.number().int().min(1).max(100_000) });

export const accessGrantResourceType = z.enum(['IAKO_PROFILE', 'DIGITAL_TOOL', 'LIVE_TRAINING']);

export const accessGrantSchema = z.object({
  resourceType: accessGrantResourceType,
  resourceId: z.string().trim().min(1).max(200),
  userId: z.string().uuid().nullable().optional().default(null),
  email: z.string().trim().email().max(320).nullable().optional().default(null),
  startsAt: z.coerce.date().nullable().optional().default(null),
  expiresAt: z.coerce.date().nullable().optional().default(null),
  note: z.string().trim().max(500).nullable().optional().default(null),
}).superRefine((data, ctx) => {
  if (!data.userId && !data.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Provide either a userId or an email.' });
  if (data.userId && data.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Provide only one of userId or email, not both.' });
});

export const manualEnrollmentSchema = z.object({
  email: z.string().trim().email().max(320),
}).or(z.object({ userId: z.string().uuid() }));

export const createInviteSchema = z.object({
  policy: z.enum(['FREE_ENROLLMENT', 'REGISTRATION_ONLY', 'PAYMENT_REQUIRED']).optional(),
  requiresApproval: z.boolean().optional().default(false),
  startsAt: z.coerce.date().nullable().optional().default(null),
  email: z.string().trim().email().max(320).nullable().optional().default(null),
  maxRedemptions: z.number().int().min(1).max(10000).optional().default(1),
  expiresAt: z.coerce.date().nullable().optional().default(null),
});
