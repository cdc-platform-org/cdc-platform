import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { rateLimit } from '../middleware/rateLimit';
import { createStudioInquirySchema } from '../schemas/studioSchemas';
import { sendStudioInquiryEmail } from '../services/emailService';

const router = Router();

// Anonymous prospective clients — generous enough for a real visitor
// retrying a typo, tight enough to blunt a scripted spam flood.
const studioInquiryRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many inquiries submitted. Please try again later.',
});

router.post('/inquiries', studioInquiryRateLimit, async (req: Request, res: Response) => {
  const result = createStudioInquirySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const inquiry = await prisma.studioInquiry.create({ data: result.data });

  // Never let a broken admin-notification email block the client from
  // getting their success response — the inquiry is already persisted.
  sendStudioInquiryEmail(inquiry.id, inquiry.name, inquiry.email, inquiry.projectType).catch((err) =>
    console.error('[studio] Failed to send inquiry notification email:', err)
  );

  res.status(201).json({ data: { id: inquiry.id } });
});

export default router;
