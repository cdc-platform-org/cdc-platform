import { z } from 'zod';

export const createStudioInquirySchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  // Required — a lead with no phone number is the exact gap this
  // validation closes (the team needs a direct callback number, not just
  // email, to actually chase a lead).
  phone: z.string().trim().min(5, 'A valid phone number is required.').max(50),
  company: z.string().trim().min(1, 'Company is required.').max(200),
  projectType: z.string().trim().min(1, 'Project type is required.').max(200),
  budgetRange: z.string().trim().min(1, 'Budget range is required.').max(100),
  message: z.string().trim().min(1, 'Message is required.').max(5000),
});

export const updateStudioInquirySchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'ACCEPTED', 'DECLINED']).optional(),
  adminNote: z.string().trim().max(1000).optional(),
});
