import { z } from 'zod';

export const createStudioInquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  projectType: z.string().trim().min(1, 'Project type is required.').max(200),
  budgetRange: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1, 'Message is required.').max(5000),
});

export const updateStudioInquirySchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'ACCEPTED', 'DECLINED']).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});
