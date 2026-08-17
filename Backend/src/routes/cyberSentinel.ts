import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { rateLimit } from '../middleware/rateLimit';
import { createCyberSentinelWaitlistSchema } from '../schemas/cyberSentinelSchemas';
import { sendCyberSentinelWaitlistEmail } from '../services/emailService';

const router = Router();

// Anonymous prospective users — same rate-limit shape as studio.ts's
// inquiry form (generous enough for a real visitor retyping a typo'd
// email, tight enough to blunt a scripted spam flood).
const waitlistRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many signups submitted. Please try again later.',
});

router.post('/waitlist', waitlistRateLimit, async (req: Request, res: Response) => {
  const result = createCyberSentinelWaitlistSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const entry = await prisma.cyberSentinelWaitlistEntry.create({ data: result.data });

  // Never let a broken admin-notification email block the visitor's
  // success response — the signup is already persisted.
  sendCyberSentinelWaitlistEmail(entry.id, entry.name, entry.email, entry.os).catch((err) =>
    console.error('[cyberSentinel] Failed to send waitlist notification email:', err)
  );

  res.status(201).json({ data: { id: entry.id } });
});

export default router;
