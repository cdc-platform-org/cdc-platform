import { z } from 'zod';

export const liveTrainingCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(100),
  scheduledAt: z.string().datetime(),
  titleEn: z.string().trim().min(3).max(200).optional().nullable(),
  descriptionEn: z.string().trim().min(10).max(2000).optional().nullable(),
  price: z.number().int().min(0).optional().nullable(),
  discountPercent: z.number().int().min(1).max(90).optional().nullable(),
  discountEndDate: z.string().datetime().optional().nullable(),
  isOnSale: z.boolean().optional().default(false),
  discountBadgeText: z.string().trim().max(40).optional().nullable(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  minCapacity: z.number().int().min(0).optional().default(0),
  maxCapacity: z.number().int().min(1),
  published: z.boolean().optional().default(true),
  language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
  meetingUrl: z.string().url().optional().or(z.literal('')),
  classroomUrl: z.string().url().optional().or(z.literal('')),
  recordingUrl: z.string().url().optional().or(z.literal('')),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  priceType: z.enum(['MONTHLY', 'TOTAL']).optional().default('MONTHLY'),
  durationMonths: z.number().int().min(1).max(60).optional().nullable(),
  scheduleDays: z.string().trim().max(200).optional().nullable(),
  trainerVideoUrl: z.string().url().optional().or(z.literal('')),
}).refine((data) => data.minCapacity === undefined || data.minCapacity <= data.maxCapacity, {
  message: 'minCapacity cannot exceed maxCapacity.',
  path: ['minCapacity'],
}).refine((data) => !data.startDate || !data.endDate || new Date(data.endDate) >= new Date(data.startDate), {
  message: 'endDate cannot be before startDate.',
  path: ['endDate'],
});

export const liveTrainingUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  scheduledAt: z.string().datetime().optional(),
  titleEn: z.string().trim().min(3).max(200).optional().nullable(),
  descriptionEn: z.string().trim().min(10).max(2000).optional().nullable(),
  price: z.number().int().min(0).optional().nullable(),
  discountPercent: z.number().int().min(1).max(90).optional().nullable(),
  discountEndDate: z.string().datetime().optional().nullable(),
  isOnSale: z.boolean().optional(),
  discountBadgeText: z.string().trim().max(40).optional().nullable(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  minCapacity: z.number().int().min(0).optional(),
  maxCapacity: z.number().int().min(1).optional(),
  published: z.boolean().optional(),
  language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
  meetingUrl: z.string().url().optional().or(z.literal('')),
  classroomUrl: z.string().url().optional().or(z.literal('')),
  recordingUrl: z.string().url().optional().or(z.literal('')),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  priceType: z.enum(['MONTHLY', 'TOTAL']).optional(),
  durationMonths: z.number().int().min(1).max(60).optional().nullable(),
  scheduleDays: z.string().trim().max(200).optional().nullable(),
  trainerVideoUrl: z.string().url().optional().or(z.literal('')),
  // Only ever AI-generated before now (services/liveTrainingSynopsisService.ts)
  // — an admin editing/polishing it is a plain field update, same posture
  // as courseSchemas.ts's lessonUpdateSchema conspectus fields.
  synopsisKa: z.string().trim().max(20000).optional().nullable(),
  synopsisEn: z.string().trim().max(20000).optional().nullable(),
  synopsisRu: z.string().trim().max(20000).optional().nullable(),
}).refine((data) => !data.startDate || !data.endDate || new Date(data.endDate) >= new Date(data.startDate), {
  message: 'endDate cannot be before startDate.',
  path: ['endDate'],
});

// Public, no-login registration — same shape as createStudioInquirySchema,
// phone required (not optional) since a callback number is the entire
// point of this form.
export const liveTrainingRegisterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  phone: z.string().trim().min(4, 'Enter a valid phone number.').max(50),
  // The site's currently-active locale (resolveLocale(router.locale) on the
  // frontend) at the moment the visitor submitted this form — the only
  // point in the registration/enrollment flow where a real, reliable
  // signal for "which language should this person's notifications use"
  // exists (an authenticated User has no stored locale preference; see
  // routes/liveTrainings.ts's own comment on the other trigger points).
  // Anything other than 'en' collapses to Georgian, matching every other
  // ka/en-only notification in this codebase.
  locale: z.string().trim().max(10).optional(),
});

export const liveTrainingLeadUpdateSchema = z.object({
  status: z.enum(['NOT_CONTACTED', 'CONTACTED', 'SCHEDULED', 'DECLINED']).optional(),
  adminNote: z.string().trim().max(1000).optional().nullable(),
});
