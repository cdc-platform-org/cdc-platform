import { z } from 'zod';

export const liveTrainingCreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(100),
  scheduledAt: z.string().datetime(),
  titleEn: z.string().trim().min(3).max(200).optional().nullable(),
  descriptionEn: z.string().trim().min(10).max(2000).optional().nullable(),
  price: z.number().int().min(0).optional().nullable(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  minCapacity: z.number().int().min(0).optional().default(0),
  maxCapacity: z.number().int().min(1),
  published: z.boolean().optional().default(true),
  language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
}).refine((data) => data.minCapacity === undefined || data.minCapacity <= data.maxCapacity, {
  message: 'minCapacity cannot exceed maxCapacity.',
  path: ['minCapacity'],
});

export const liveTrainingUpdateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  scheduledAt: z.string().datetime().optional(),
  titleEn: z.string().trim().min(3).max(200).optional().nullable(),
  descriptionEn: z.string().trim().min(10).max(2000).optional().nullable(),
  price: z.number().int().min(0).optional().nullable(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  minCapacity: z.number().int().min(0).optional(),
  maxCapacity: z.number().int().min(1).optional(),
  published: z.boolean().optional(),
  language: z.enum(['GEORGIAN', 'ENGLISH', 'BOTH']).optional(),
});

// Public, no-login registration — same shape as createStudioInquirySchema,
// phone required (not optional) since a callback number is the entire
// point of this form.
export const liveTrainingRegisterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  phone: z.string().trim().min(4, 'Enter a valid phone number.').max(50),
});

export const liveTrainingLeadUpdateSchema = z.object({
  status: z.enum(['NOT_CONTACTED', 'CONTACTED', 'SCHEDULED', 'DECLINED']).optional(),
  adminNote: z.string().trim().max(1000).optional().nullable(),
});
