import { z } from 'zod';

export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const safeUrl = z.string().url().max(2000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS link.');
export const guideSectionSchema = z.object({
  id: identifier,
  kind: z.enum(['objectives', 'topics', 'tools', 'concepts', 'demo', 'exercise', 'outcome', 'prompts', 'code', 'troubleshooting', 'homework', 'preview', 'resources']),
  title: z.string().trim().min(1).max(200),
  items: z.array(z.object({
    id: identifier, title: z.string().trim().min(1).max(200), body: z.string().max(12000),
    language: z.string().max(40).optional(), url: safeUrl.optional(),
  })).max(40),
});
export const trainingDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(366), title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000), scheduledDate: calendarDate.nullable().optional().default(null),
  published: z.boolean().optional().default(false), sourcePages: z.array(z.number().int().min(1).max(10000)).max(100).default([]),
  sections: z.array(guideSectionSchema).max(20),
}).superRefine((day, ctx) => {
  const sections = day.sections.map((section) => section.id);
  const items = day.sections.flatMap((section) => section.items.map((item) => item.id));
  if (new Set(sections).size !== sections.length || new Set(items).size !== items.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sections'], message: 'Section and item IDs must be unique within a day.' });
  }
});
export const guideSettingsSchema = z.object({
  timeZone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
  }, 'Enter a valid IANA timezone.').optional(),
  startDate: calendarDate.nullable().optional(), paused: z.boolean().optional(),
  currentDayOverride: z.number().int().min(1).max(366).nullable().optional(),
  visibility: z.enum(['TODAY_ONLY', 'CURRENT_AND_PREVIOUS', 'ALL_DAYS']).optional(),
});
export const guideSourceSchema = z.object({
  title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(50000),
  dayNumber: z.number().int().min(1).max(366).nullable().optional().default(null),
});
export const guideChatSchema = z.object({
  message: z.string().trim().min(1).max(4000), dayId: z.string().uuid().optional(), sectionId: identifier.optional(),
  history: z.array(z.object({ role: z.enum(['USER', 'ASSISTANT']), content: z.string().max(4000) })).max(12).default([]),
});
export type GuideSection = z.infer<typeof guideSectionSchema>;
export type TrainingDayInput = z.infer<typeof trainingDaySchema>;
