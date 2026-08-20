import { z } from 'zod';

export const createChatRequestSchema = z.object({
  recipientId: z.string().uuid(),
  introMessage: z.string().trim().max(500).optional(),
});
