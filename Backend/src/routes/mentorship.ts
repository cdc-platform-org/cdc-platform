import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireRole } from '../middleware/auth';
import {
  createMentorshipRequestSchema,
  meetingLinkSchema,
  rescheduleBookingSchema,
  cancelBookingSchema,
  chatMessageSchema,
} from '../schemas/mentorshipSchemas';
import { attachRecordingSchema, mentorAvailabilityRuleSchema } from '../schemas/adminSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { generateAvailableSlots, assertSlotAvailable, SlotUnavailableError } from '../services/mentorAvailabilityService';
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
    // mentorPublished is the real gate here — a promoted Mentor account
    // (adminMentorship.ts's /mentors/promote) starts unpublished and stays
    // that way until an admin explicitly publishes the profile. status
    // isn't used for this: it governs login/account-level access for every
    // role, not directory visibility, and would already be APPROVED for
    // most promoted mentors (they were an approved Student/Client first).
    where: { role: 'Mentor', isBanned: false, mentorPublished: true },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      bioEn: true,
      mentorTitle: true,
      mentorTitleEn: true,
      mentorHourlyRate: true,
      mentorSkills: true,
      mentorLanguages: true,
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

  // Lazily flip any still-SCHEDULED booking whose time has passed to
  // COMPLETED — no cron for this; nothing here needs it set the instant the
  // session ends, only "eventually, next time anyone looks."
  const nowPast = confirmed.filter((b) => b.status === 'SCHEDULED' && b.scheduledAt.getTime() < Date.now());
  if (nowPast.length > 0) {
    await prisma.$transaction([
      prisma.mentorshipBooking.updateMany({ where: { id: { in: nowPast.map((b) => b.id) } }, data: { status: 'COMPLETED' } }),
      prisma.mentorBookingHistory.createMany({
        data: nowPast.map((b) => ({ bookingId: b.id, action: 'COMPLETED', performedById: null })),
      }),
    ]);
    nowPast.forEach((b) => (b.status = 'COMPLETED'));
  }

  res.json({
    data: confirmed.map((b) => ({
      id: b.id,
      role: b.studentId === req.user!.id ? 'student' : 'mentor',
      mentor: b.mentor,
      student: b.student,
      scheduledAt: b.scheduledAt,
      status: b.status,
      studentPhone: b.studentPhone,
      consultationDescription: b.consultationDescription,
      googleMeetLink: b.googleMeetLink,
      calendarSyncError: b.calendarSyncError,
      recordingUrl: b.recordingUrl,
    })),
  });
});

// Shared ownership guard for every /bookings/:id/* route below — either
// participant (mentor or student), never a third party. Returns the
// booking or null (caller 404s) rather than throwing, since "not found" and
// "not yours" are deliberately indistinguishable to the caller.
async function loadOwnedBooking(bookingId: string, userId: string) {
  const booking = await prisma.mentorshipBooking.findUnique({ where: { id: bookingId } });
  if (!booking || (booking.mentorId !== userId && booking.studentId !== userId)) return null;
  return booking;
}

// ============================================================
// RESCHEDULE — either participant can move their own SCHEDULED booking to a
// new time (re-validated against the mentor's current availability, same
// assertSlotAvailable check the original booking went through). Logs a
// MentorBookingHistory row; does not touch payment/commission fields.
// ============================================================
router.patch('/bookings/:id/reschedule', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = rescheduleBookingSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const booking = await loadOwnedBooking(req.params.id, req.user!.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.status !== 'SCHEDULED') {
    return res.status(400).json({ message: 'Only a scheduled session can be rescheduled.' });
  }

  const newScheduledAt = new Date(result.data.scheduledAt);
  try {
    await assertSlotAvailable(booking.mentorId, newScheduledAt);
  } catch (err) {
    if (err instanceof SlotUnavailableError) return res.status(400).json({ message: err.message });
    throw err;
  }

  const [updated] = await prisma.$transaction([
    prisma.mentorshipBooking.update({ where: { id: booking.id }, data: { scheduledAt: newScheduledAt } }),
    prisma.mentorBookingHistory.create({
      data: {
        bookingId: booking.id,
        action: 'RESCHEDULED',
        performedById: req.user!.id,
        previousScheduledAt: booking.scheduledAt,
        newScheduledAt,
        note: result.data.note ?? null,
      },
    }),
  ]);

  res.json({ data: updated });
});

// ============================================================
// CANCEL — either participant. Refund/payout reversal is out of scope here
// (no refund flow exists for mentorship bookings today) — this only marks
// the session cancelled and logs it; an admin handles any money question
// through the existing dispute/refund process.
// ============================================================
router.post('/bookings/:id/cancel', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = cancelBookingSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const booking = await loadOwnedBooking(req.params.id, req.user!.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.status !== 'SCHEDULED') {
    return res.status(400).json({ message: 'Only a scheduled session can be cancelled.' });
  }

  const [updated] = await prisma.$transaction([
    prisma.mentorshipBooking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } }),
    prisma.mentorBookingHistory.create({
      data: { bookingId: booking.id, action: 'CANCELLED', performedById: req.user!.id, note: result.data.note ?? null },
    }),
  ]);

  res.json({ data: updated });
});

// ============================================================
// CHAT — GET/POST /bookings/:id/messages. Every send is checked by
// sanitizeChatMessage (utils/sanitizeChatMessage.ts, already the
// platform-wide "no off-platform contact info" filter — forum, DMs,
// vacancy applications). A flagged message is never stored or delivered;
// it's logged to MentorChatViolation instead. The SECOND violation by the
// same user (counted across all their bookings, not just this one) bans
// their account outright — requireApproved already rejects every
// subsequent request for a banned user, which is the actual enforcement.
// ============================================================
router.get('/bookings/:id/messages', authenticate, requireApproved, async (req: Request, res: Response) => {
  const booking = await loadOwnedBooking(req.params.id, req.user!.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  const messages = await prisma.mentorChatMessage.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: messages });
});

router.post('/bookings/:id/messages', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = chatMessageSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const booking = await loadOwnedBooking(req.params.id, req.user!.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  const receiverId = booking.mentorId === req.user!.id ? booking.studentId : booking.mentorId;
  const { wasFiltered } = sanitizeChatMessage(result.data.content);

  if (wasFiltered) {
    await prisma.mentorChatViolation.create({
      data: {
        bookingId: booking.id,
        userId: req.user!.id,
        attemptedContent: result.data.content,
        detectedReason: 'Message contained off-platform contact info / payment phrasing (sanitizeChatMessage).',
      },
    });

    const violationCount = await prisma.mentorChatViolation.count({ where: { userId: req.user!.id } });
    if (violationCount >= 2) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { isBanned: true } });
      return res.status(403).json({
        blocked: true,
        banned: true,
        message: 'ⓘ თქვენი ანგარიში დაბლოკილია პლატფორმის გარეთ კომუნიკაციის განმეორებითი მცდელობის გამო.',
      });
    }

    return res.status(422).json({
      blocked: true,
      banned: false,
      message: '⚠️ პლატფორმის გარეთ კომუნიკაცია და გადახდა აკრძალულია საკომისიოს თავიდან არიდების მიზნით.',
    });
  }

  const message = await prisma.mentorChatMessage.create({
    data: { bookingId: booking.id, senderId: req.user!.id, receiverId, content: result.data.content },
  });
  res.status(201).json({ data: message });
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

// Mentor self-serve: manually set/replace the Meet/Zoom link on their OWN
// upcoming booking — googleMeetLink is normally auto-filled by the Calendar
// integration at payment time (routes/payments.ts), but a mentor can
// override it here if that integration failed/isn't configured, or they
// want to use a different tool. Scoped by mentorId, same as the recording
// route above.
router.patch('/bookings/:id/meeting-link', authenticate, requireApproved, requireRole('Mentor'), async (req: Request, res: Response) => {
  const result = meetingLinkSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const booking = await prisma.mentorshipBooking.findUnique({ where: { id: req.params.id }, select: { mentorId: true } });
  if (!booking || booking.mentorId !== req.user!.id) {
    return res.status(404).json({ message: 'Booking not found.' });
  }

  const updated = await prisma.mentorshipBooking.update({
    where: { id: req.params.id },
    data: { googleMeetLink: result.data.meetingLink, calendarSyncError: null },
  });
  res.json({ data: updated });
});

// ============================================================
// MENTOR SELF-SERVICE — a Mentor managing their OWN hourly rate and weekly
// availability, without needing an admin (see routes/adminMentorship.ts,
// which does the same thing but admin-side for any mentor by id). Every
// route below is scoped to req.user!.id, never a :mentorId param.
// ============================================================

const mentorProfileSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  bioEn: true,
  mentorTitle: true,
  mentorTitleEn: true,
  mentorHourlyRate: true,
  mentorSkills: true,
  mentorLanguages: true,
  cvUrl: true,
  // Read-only here too — lets a mentor see whether an admin has published
  // them yet without granting any route that lets them change it themselves.
  mentorPublished: true,
} as const;

// Read-only — mentors can see their own listing (title/rate/skills/CV) but
// can no longer edit it here. Editing is admin-only now, via
// adminMentorship.ts's PUT /mentors/:mentorId/profile (/admin/mentorship in
// the CMS) — a mentor who wants a change contacts CDC support instead of
// self-serving it, same posture as course pricing/catalog content.
router.get('/me/profile', authenticate, requireRole('Mentor'), async (req: Request, res: Response) => {
  const mentor = await prisma.user.findUnique({ where: { id: req.user!.id }, select: mentorProfileSelect });
  res.json({ data: mentor });
});

router.get('/me/availability', authenticate, requireRole('Mentor'), async (req: Request, res: Response) => {
  const rules = await prisma.mentorAvailabilityRule.findMany({
    where: { mentorId: req.user!.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
  res.json({ data: rules });
});

router.post('/me/availability', authenticate, requireRole('Mentor'), async (req: Request, res: Response) => {
  const result = mentorAvailabilityRuleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const rule = await prisma.mentorAvailabilityRule.create({
    data: { mentorId: req.user!.id, ...result.data },
  });
  res.status(201).json({ data: rule });
});

router.put('/me/availability/:ruleId', authenticate, requireRole('Mentor'), async (req: Request, res: Response) => {
  const result = mentorAvailabilityRuleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  // mentorId isn't part of mentorAvailabilityRuleSchema, so the ownership
  // check has to be an explicit findFirst before the update, not just a
  // `where: { id, mentorId }` on the update itself failing silently.
  const owned = await prisma.mentorAvailabilityRule.findFirst({ where: { id: req.params.ruleId, mentorId: req.user!.id } });
  if (!owned) return res.status(404).json({ message: 'Availability rule not found.' });

  const rule = await prisma.mentorAvailabilityRule.update({ where: { id: req.params.ruleId }, data: result.data });
  res.json({ data: rule });
});

router.delete('/me/availability/:ruleId', authenticate, requireRole('Mentor'), async (req: Request, res: Response) => {
  const owned = await prisma.mentorAvailabilityRule.findFirst({ where: { id: req.params.ruleId, mentorId: req.user!.id } });
  if (!owned) return res.status(404).json({ message: 'Availability rule not found.' });

  await prisma.mentorAvailabilityRule.delete({ where: { id: req.params.ruleId } });
  res.status(204).send();
});

export default router;
