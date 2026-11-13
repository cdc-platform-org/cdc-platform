/**
 * BOG checkout for a paid mentorship session (POST /checkout/mentorship),
 * including the race-safe slot booking transaction.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { authenticate, requireApproved } from '../../middleware/auth';
import { checkoutMentorshipSchema } from '../../schemas/paymentSchemas';
import { paymentModelForPurpose } from '../../services/paymentModel';
import { assertSlotAvailable, SlotUnavailableError } from '../../services/mentorAvailabilityService';
import { checkoutRateLimit, CALLBACK_URL, checkoutLang, resultRedirects, createBogOrderOrRespond } from './shared';

const router = Router();

// The availability check and the booking INSERT run inside one Serializable
// transaction so two concurrent checkouts for the same mentor/time can't
// both pass assertSlotAvailable's read and both create a booking — Postgres
// aborts the loser with a serialization failure (P2034) instead of silently
// double-booking the slot. One retry covers the ordinary case of losing
// that race once; a second collision surfaces as SlotUnavailableError,
// same as a "genuinely already booked" result, so callers only need to
// handle one error type either way.
async function createMentorshipCheckoutRecords(params: {
  mentorId: string;
  studentId: string;
  scheduledAt: Date;
  chargeAmount: number;
  currency: string;
  studentPhone: string;
  consultationDescription?: string;
}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await assertSlotAvailable(params.mentorId, params.scheduledAt, undefined, tx);
          // No reusable-pending-order shortcut here (unlike course/product/
          // gig-escrow checkouts) — a prior PENDING order may have been for
          // a different scheduledAt, and reusing it would silently book
          // the wrong time.
          const bogPayment = await tx.bogPayment.create({
            data: {
              bogOrderId: `pending-${crypto.randomUUID()}`,
              userId: params.studentId,
              purpose: 'MENTORSHIP',
              paymentModel: paymentModelForPurpose('MENTORSHIP'),
              referenceId: params.mentorId,
              amount: params.chargeAmount,
              currency: params.currency,
              status: 'PENDING',
            },
          });
          const booking = await tx.mentorshipBooking.create({
            data: {
              bogPaymentId: bogPayment.id,
              mentorId: params.mentorId,
              studentId: params.studentId,
              scheduledAt: params.scheduledAt,
              studentPhone: params.studentPhone,
              consultationDescription: params.consultationDescription || null,
            },
          });
          return { bogPayment, booking };
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (err) {
      if (err instanceof SlotUnavailableError) throw err;
      const isSerializationConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
      if (isSerializationConflict && attempt === 0) continue;
      if (isSerializationConflict) {
        throw new SlotUnavailableError('This time slot was just booked by someone else. Please pick another.');
      }
      throw err;
    }
  }
  throw new SlotUnavailableError('This time slot was just booked by someone else. Please pick another.');
}

// ============================================================
// CHECKOUT — MENTORSHIP SESSION
// Creates a MentorshipBooking alongside the BogPayment so the chosen
// slot/phone/description survive the BOG redirect round-trip; the actual
// Google Calendar event is created once applyBogPaymentResult() below
// confirms payment (see services/googleCalendarService.ts).
// ============================================================
router.post(
  '/checkout/mentorship',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const result = checkoutMentorshipSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const mentor = await prisma.user.findUnique({ where: { id: result.data.mentorId } });
    if (!mentor || mentor.role !== 'Mentor') {
      return res.status(404).json({ message: 'Mentor not found.' });
    }
    // The price is never trusted from the client — same posture as course
    // checkout's getCurrentPrice(course) above. mentorHourlyRate is the one
    // authoritative rate (minor units/GEL, same convention as Course prices)
    // an admin sets on /admin/mentorship; a mentor with no rate configured
    // isn't bookable rather than falling back to whatever a client sends.
    if (!mentor.mentorHourlyRate || mentor.mentorHourlyRate <= 0) {
      return res.status(400).json({ message: 'This mentor does not have a session rate configured yet.' });
    }
    const chargeAmount = mentor.mentorHourlyRate;
    const currency = 'GEL';

    const scheduledAt = new Date(result.data.scheduledAt);

    let bogPayment, booking;
    try {
      ({ bogPayment, booking } = await createMentorshipCheckoutRecords({
        mentorId: mentor.id,
        studentId: req.user!.id,
        scheduledAt,
        chargeAmount,
        currency,
        studentPhone: result.data.studentPhone,
        consultationDescription: result.data.consultationDescription,
      }));
    } catch (err) {
      if (err instanceof SlotUnavailableError) return res.status(400).json({ message: err.message });
      throw err;
    }
    // Logged at checkout time, same as the booking row itself — a
    // never-completed-payment booking still shows a real "created" event,
    // matching how the row exists in the DB regardless of payment outcome.
    await prisma.mentorBookingHistory.create({
      data: { bookingId: booking.id, action: 'CREATED', performedById: req.user!.id, newScheduledAt: scheduledAt },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency,
      basketItemName: `Mentorship session with ${mentor.name}`,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) return;
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

export default router;
