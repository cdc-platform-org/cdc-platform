import { z } from 'zod';

export const createMentorshipRequestSchema = z.object({
  message: z.string().trim().min(5).max(2000),
});
