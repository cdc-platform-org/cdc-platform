import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { createMentorshipRequestSchema } from '../schemas/mentorshipSchemas';
import { attachRecordingSchema } from '../schemas/adminSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { generateAvailableSlots } from '../services/mentorAvailabilityService';
import { attachMentorshipRecording, MentorshipRecordingError } from '../services/mentorshipRecordingService';

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

// ============================================================
// MY BOOKINGS — every paid mentorship session the current user is part of,
// as either the student who booked it or the mentor being booked (a Mentor
// account is still just a User, so both roles can land here). Distinct
// endpoint from GET /mine above (that one is the free help-request queue).
// ============================================================
router.get('/bookings/mine', authenticate, async (req: Request, res: Response) => {
  const bookings = await prisma.mentorshipBooking.findMany({
    where: { OR: [{ studentId: req.user!.id }, { mentorId: req.user!.id }] },
    include: {
      mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
      student: { select: { id: true, name: true, email: true, avatarUrl: true } },
      bogPayment: { select: { status: true } },
    },
    orderBy: { scheduledAt: 'desc' },
  });
  // Only surface bookings whose payment actually completed — a booking row
  // is created at checkout time (before payment), so a PENDING/FAILED one
  // was never a real confirmed session.
  const confirmed = bookings.filter((b) => b.bogPayment.status === 'COMPLETED');
  res.json({
    data: confirmed.map((b) => ({
      id: b.id,
      role: b.studentId === req.user!.id ? 'student' : 'mentor',
      mentor: b.mentor,
      student: b.student,
      scheduledAt: b.scheduledAt,
      studentPhone: b.studentPhone,
      consultationDescription: b.consultationDescription,
      googleMeetLink: b.googleMeetLink,
      calendarSyncError: b.calendarSyncError,
      recordingUrl: b.recordingUrl,
    })),
  });
});

// Mentor self-serve: attach/replace a recording link on their OWN booking
// — scoped by mentorId so a mentor can't touch anyone else's session.
// Same underlying attach-and-email-once logic as the admin route
// (routes/adminMentorship.ts's PATCH /bookings/:id/recording).
router.patch('/bookings/:id/recording', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = attachRecordingSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const booking = await prisma.mentorshipBooking.findUnique({ where: { id: req.params.id }, select: { mentorId: true } });
  if (!booking || booking.mentorId !== req.user!.id) {
    return res.status(404).json({ message: 'Booking not found.' });
  }

  try {
    const updated = await attachMentorshipRecording(req.params.id, result.data.recordingUrl);
    res.json({ data: updated });
  } catch (err) {
    if (err instanceof MentorshipRecordingError) return res.status(404).json({ message: err.message });
    throw err;
  }
});

export default router;
