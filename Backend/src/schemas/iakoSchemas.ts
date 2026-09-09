import { z } from 'zod';

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
});

export const iakoAssignmentSchema = z.object({
  profileId: z.string().uuid().nullable(),
});

export const iakoChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

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
  email: z.string().trim().email().max(320).nullable().optional().default(null),
  maxRedemptions: z.number().int().min(1).max(10000).optional().default(1),
  expiresAt: z.coerce.date().nullable().optional().default(null),
});
