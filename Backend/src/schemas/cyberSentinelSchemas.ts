import { z } from 'zod';

export const createCyberSentinelWaitlistSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(200),
  email: z.string().trim().email('Enter a valid email.').max(255),
  os: z.enum(['WINDOWS', 'MAC', 'LINUX']),
});
