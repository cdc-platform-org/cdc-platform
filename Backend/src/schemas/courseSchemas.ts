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
    titleEn: z.string().trim().max(200).optional(),
    description: z.string().min(20),
    // No min() — same leniency as titleEn above (a blank optional field
    // submits as an empty string from the admin form, not `undefined`, so a
    // min() here would reject "just leave it empty" rather than treat it as
    // unset).
    descriptionEn: z.string().trim().optional(),
    category: z.string().min(2).max(100),
    lessons: z.array(lessonSchema).min(1),
    published: z.boolean().optional().default(false),
    mentorName: z.string().trim().max(200).optional(),
    mentorTitle: z.string().trim().max(200).optional(),
    thumbnailUrl: z.string().trim().max(2000).optional(),
    coverImageUrl: z.string().trim().max(2000).optional(),
    mentorAvatarUrl: z.string().trim().max(2000).optional(),
    language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
    // Freelancer skills this course teaches (src/data/freelancerSkills.ts
    // values or free text) — auto-verifies each on a student's profile the
    // moment they earn this course's certificate, see routes/courses.ts's
    // autoVerifySkillsForCourse().
    skillsTaught: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    ...coursePricingFields,
  })
  .refine((data) => !data.isOnSale || !!data.discountPercent, {
    message: 'discountPercent is required when isOnSale is true.',
    path: ['discountPercent'],
  });

export const courseUpdateSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    titleEn: z.string().trim().max(200).optional(),
    description: z.string().min(20).optional(),
    descriptionEn: z.string().trim().optional(),
    category: z.string().min(2).max(100).optional(),
    lessons: z.array(lessonSchema).min(1).optional(),
    published: z.boolean().optional(),
    mentorName: z.string().trim().max(200).optional(),
    mentorTitle: z.string().trim().max(200).optional(),
    thumbnailUrl: z.string().trim().max(2000).optional(),
    coverImageUrl: z.string().trim().max(2000).optional(),
    mentorAvatarUrl: z.string().trim().max(2000).optional(),
    language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
    skillsTaught: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
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
  titleEn: z.string().trim().max(200).optional().nullable(),
  order: z.number().int().min(0),
});

export const sectionUpdateSchema = sectionCreateSchema.partial();

export const lessonCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().default(0),
  resources: z.array(z.string().trim().max(2000)).optional().default([]),
  order: z.number().int().min(0),
  isFreePreview: z.boolean().optional().default(false),
  assignmentPrompt: z.string().trim().max(5000).optional().nullable(),
  assignmentPromptEn: z.string().trim().max(5000).optional().nullable(),
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

// --- Course discussion (per-course Q&A on /learn) ---

export const courseDiscussionPostCreateSchema = z.object({
  content: z.string().trim().min(2).max(4000),
  // One level of replies only — a reply's own parentId, if it had one,
  // would make this a nested thread rather than the flat "question + its
  // answers" shape this feature is meant to be. Enforced in the route
  // handler (which loads the parent), not expressible in the schema alone.
  parentId: z.string().uuid().optional(),
});

// --- Homework assignments ---

export const submitAssignmentSchema = z
  .object({
    fileUrl: z.string().url().optional(),
    linkUrl: z.string().url().optional(),
    comment: z.string().trim().max(3000).optional(),
  })
  .refine((data) => !!data.fileUrl || !!data.linkUrl, {
    message: 'Provide a file or a link.',
    path: ['fileUrl'],
  });

export const gradeAssignmentSchema = z.object({
  status: z.enum(['APPROVED', 'NEEDS_REVISION']),
  feedback: z.string().trim().max(3000).optional().nullable(),
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
