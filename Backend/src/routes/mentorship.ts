import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { createMentorshipRequestSchema } from '../schemas/mentorshipSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { generateAvailableSlots } from '../services/mentorAvailabilityService';

const router = Router();

// "დახმარება / მენტორობა" — the Dashboard button, CDC Verified Graduates
// only. General order/gig assistance, not tied to any specific gig (compare
// Gig.mentorHelpRequestedAt, which is scoped to one first-order gig).
router.post('/', authenticate, requireApproved, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isVerifiedGraduate: true } });
  if (!user?.isVerifiedGraduate) {
    return res.status(403).json({ message: 'დახმარების მოთხოვნის გაგზავნა შესაძლებელია მხოლოდ CDC-ის კურსდამთავრებულებისთვის.' });
  }

  const result = createMentorshipRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { sanitized: message } = sanitizeChatMessage(result.data.message);

  const request = await prisma.mentorshipRequest.create({
    data: { userId: req.user!.id, message },
  });
  res.status(201).json({ data: request });
});

router.get('/mine', authenticate, async (req: Request, res: Response) => {
  const requests = await prisma.mentorshipRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

// ============================================================
// PUBLIC MENTOR DIRECTORY — no auth required to browse; only the actual
// checkout (POST /payments/checkout/mentorship) requires a logged-in,
// approved account.
// ============================================================

router.get('/mentors', async (_req: Request, res: Response) => {
  const mentors = await prisma.user.findMany({
    where: { role: 'Mentor', isBanned: false },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      mentorTitle: true,
      mentorHourlyRate: true,
      mentorSkills: true,
      cvUrl: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json({ data: mentors });
});

// Read-only weekly rules for a paid-session booking UI to render as
// selectable slots. The actual availability check at checkout time
// (mentorAvailabilityService.assertSlotAvailable) is authoritative — this is
// just what a client renders as "available" before submitting.
router.get('/mentors/:mentorId/availability', async (req: Request, res: Response) => {
  const rules = await prisma.mentorAvailabilityRule.findMany({
    where: { mentorId: req.params.mentorId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    select: { dayOfWeek: true, startMinute: true, endMinute: true },
  });
  res.json({ data: rules });
});

// Concrete bookable datetimes over the next N days — what the booking modal
// actually renders as clickable slots (already excludes taken times).
router.get('/mentors/:mentorId/slots', async (req: Request, res: Response) => {
  const days = Math.min(30, Math.max(1, Number(req.query.days) || 14));
  const slots = await generateAvailableSlots(req.params.mentorId, days);
  res.json({ data: slots.map((d) => d.toISOString()) });
});

export default router;
