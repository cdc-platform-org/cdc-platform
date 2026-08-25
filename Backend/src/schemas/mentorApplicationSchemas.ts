import { z } from 'zod';

export const mentorApplicationCreateSchema = z.object({
  background: z.string().trim().min(20).max(4000),
  linkedinUrl: z.string().trim().url().max(500).optional().nullable(),
  bio: z.string().trim().min(20).max(2000),
  teachingTopics: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
});

export const mentorApplicationRejectSchema = z.object({
  rejectionReason: z.string().trim().min(5).max(1000),
});
