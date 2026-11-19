/**
 * Zod request schemas for /api/course-mentor (routes/courseMentor.ts).
 * Exports: courseInputSchema, lessonEditSchema.
 */
import { z } from 'zod';

const SITE_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'tr', 'uk', 'az', 'hy'] as const;
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const courseInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  audience: z.string().trim().min(3).max(2000),
  goals: z.string().trim().min(3).max(3000),
  instructions: z.string().trim().max(4000).optional().nullable(),
  teachingLocale: z.enum(SITE_LOCALES).default('ka'),
  startDate: isoDay,
  endDate: isoDay,
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  minutesPerLesson: z.number().int().min(15).max(480),
  excludedDates: z.array(isoDay).max(400).default([]),
});

export const lessonEditSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    objectives: z.array(z.string().trim().min(1).max(300)).min(1).max(10).optional(),
    topics: z.array(z.string().trim().min(1).max(200)).min(1).max(15).optional(),
    summary: z.string().trim().min(1).max(1500).optional(),
    homework: z.object({ description: z.string().trim().min(1).max(1000), deliverable: z.string().trim().min(1).max(300) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');
