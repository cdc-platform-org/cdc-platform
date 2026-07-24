import { z } from 'zod';

export const lessonSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  durationMinutes: z.number().min(1),
  resources: z.array(z.string().url()).optional()
});

const coursePricingFields = {
  originalPrice: z.number().int().min(0),
  isOnSale: z.boolean().optional().default(false),
  discountPercent: z.number().int().min(1).max(90).optional().nullable(),
  // Accepts an ISO string from the admin form's <input type="datetime-local">.
  discountEndDate: z.string().datetime().optional().nullable().or(z.literal('')),
};

export const courseCreateSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(20),
    category: z.string().min(2).max(100),
    lessons: z.array(lessonSchema).min(1),
    published: z.boolean().optional().default(false),
    mentorName: z.string().trim().max(200).optional(),
    mentorTitle: z.string().trim().max(200).optional(),
    thumbnailUrl: z.string().trim().max(2000).optional(),
    language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
    ...coursePricingFields,
  })
  .refine((data) => !data.isOnSale || !!data.discountPercent, {
    message: 'discountPercent is required when isOnSale is true.',
    path: ['discountPercent'],
  });

export const courseUpdateSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(20).optional(),
    category: z.string().min(2).max(100).optional(),
    lessons: z.array(lessonSchema).min(1).optional(),
    published: z.boolean().optional(),
    mentorName: z.string().trim().max(200).optional(),
    mentorTitle: z.string().trim().max(200).optional(),
    thumbnailUrl: z.string().trim().max(2000).optional(),
    language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
    ...coursePricingFields,
    originalPrice: coursePricingFields.originalPrice.optional(),
    isOnSale: coursePricingFields.isOnSale.optional(),
  })
  .refine((data) => !data.isOnSale || !!data.discountPercent, {
    message: 'discountPercent is required when isOnSale is true.',
    path: ['discountPercent'],
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

export const lessonUpdateSchema = lessonCreateSchema.partial().extend({
  // Manual fallback for when direct-upload-to-Bunny fails/isn't configured
  // — accepts either a raw Bunny Stream video GUID or a full embed URL
  // (the URL is parsed down to just the ID before saving, see routes/courses.ts).
  bunnyVideoId: z.string().trim().max(500).optional().nullable(),
});

export const lessonProgressUpdateSchema = z.object({
  completed: z.boolean(),
});

// --- AI Exam & Certification Gate ---

export const examSettingsSchema = z.object({
  passingScore: z.number().int().min(1).max(100).optional().default(95),
  cooldownHours: z.number().int().min(0).max(24 * 30).optional().default(24),
  questionCount: z.number().int().min(3).max(30).optional().default(10),
  aiPromptContext: z.string().trim().max(2000).optional().nullable(),
});

export const examSubmitSchema = z.object({
  sessionToken: z.string().min(1),
  // questionId -> selected option letter.
  answers: z.record(z.string(), z.enum(['A', 'B', 'C', 'D'])),
});
