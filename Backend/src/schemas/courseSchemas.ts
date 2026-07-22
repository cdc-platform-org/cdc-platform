import { z } from 'zod';

export const lessonSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  durationMinutes: z.number().min(1),
  resources: z.array(z.string().url()).optional()
});

export const courseCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(20),
  category: z.string().min(2).max(100),
  lessons: z.array(lessonSchema).min(1),
  price: z.number().int().min(0),
  published: z.boolean().optional().default(false),
  mentorName: z.string().trim().max(200).optional(),
  mentorTitle: z.string().trim().max(200).optional(),
  thumbnailUrl: z.string().trim().max(2000).optional(),
});

export const courseUpdateSchema = courseCreateSchema.partial().extend({
  published: z.boolean().optional()
});

// --- LMS curriculum (relational) ---

export const sectionCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  order: z.number().int().min(0),
});

export const sectionUpdateSchema = sectionCreateSchema.partial();

export const lessonCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  durationSeconds: z.number().int().min(0).optional().default(0),
  resources: z.array(z.string().trim().max(2000)).optional().default([]),
  order: z.number().int().min(0),
});

export const lessonUpdateSchema = lessonCreateSchema.partial();

export const lessonProgressUpdateSchema = z.object({
  completed: z.boolean(),
});
