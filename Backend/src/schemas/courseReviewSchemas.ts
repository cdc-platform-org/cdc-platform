import { z } from 'zod';

// Structural/audio/video notes sent back to the instructor — required (an
// empty "please fix it" with no explanation isn't actionable feedback).
export const courseRequestRevisionSchema = z.object({
  feedback: z.string().trim().min(10).max(4000),
});

export const courseRejectSchema = z.object({
  reason: z.string().trim().min(10).max(4000),
});

export const instructorCourseCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  titleEn: z.string().trim().max(200).optional(),
  description: z.string().trim().min(20),
  descriptionEn: z.string().trim().optional(),
  category: z.string().trim().min(2).max(100),
  originalPrice: z.number().int().min(0),
  language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
  skillsTaught: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

// Deliberately excludes status — an instructor never sets it directly, only
// via POST /:id/submit-for-review (see routes/instructorCourses.ts).
export const instructorCourseUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  titleEn: z.string().trim().max(200).optional(),
  description: z.string().trim().min(20).optional(),
  descriptionEn: z.string().trim().optional(),
  category: z.string().trim().min(2).max(100).optional(),
  originalPrice: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().trim().max(2000).optional(),
  coverImageUrl: z.string().trim().max(2000).optional(),
  introVideoUrl: z.string().trim().max(2000).optional(),
  language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
  skillsTaught: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});
