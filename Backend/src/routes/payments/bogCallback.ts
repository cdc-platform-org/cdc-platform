/**
 * BOG webhook + status polling. applyBogPaymentResult() is the single place
 * that turns a gateway result into a completed/failed purchase for every
 * payment purpose; it is also used by admin reconciliation
 * (paymentReconciliationService, adminFinance).
 */
import { Router, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { captureHRSupportEscrow } from '../../services/hrSupportEscrowService';
import { getBogOrderDetails, verifyBogCallbackSignature, BogOrderStatusKey } from '../../services/bogPaymentService';
import { captureEscrow } from '../../services/escrowService';
import { completeProductPurchase } from '../../services/productSaleService';
import { completeCoursePurchase } from '../../services/courseSaleService';
import { DEFAULT_SESSION_MINUTES } from '../../services/mentorAvailabilityService';
import { createMentorshipCalendarEvent } from '../../services/googleCalendarService';
import { captureMentorshipEscrow } from '../../services/mentorshipEscrowService';
import { sendMentorshipBookingEmails, sendHRSupportRequestAlertEmail } from '../../services/emailService';
import { notifyCourseEnrollment } from '../../services/courseEnrollmentNotification';
import { completeLiveTrainingPurchase } from '../../services/liveTrainingSaleService';
import { completeLearningPayment } from '../../services/learningPaymentFulfillment';
import { completeTutorSubscriptionPurchase } from '../../services/englishTutorSubscriptionService';
import { completeEducatorVipPurchase } from '../../services/educatorVipService';
import { completeAgentPurchase } from '../../services/agentSubscriptionService';
import { completeChildrensBookPurchase } from '../../services/bookPurchaseFulfillment';
import { startFinalGeneration } from '../../services/bookFinalGenerationService';
import { completeBookAnimationPurchase } from '../../services/bookAnimationService';
import { fulfillGiftCardPurchase, cancelGiftCardPurchase, releaseGiftCardHold } from '../../services/giftCardService';

const router = Router();

// ============================================================
// CALLBACK / WEBHOOK — public, no auth. Authenticity comes entirely from
// the RSA signature (see bogPaymentService.verifyBogCallbackSignature),
// verified against the raw request body captured by server.ts's
// express.json({ verify }) hook.
// ============================================================
router.post('/bog/callback', async (req: Request, res: Response) => {
  const signature = req.headers['callback-signature'];
  if (typeof signature !== 'string' || !req.rawBody) {
    return res.status(400).json({ message: 'Missing callback signature.' });
  }
  if (!verifyBogCallbackSignature(req.rawBody, signature)) {
    return res.status(400).json({ message: 'Invalid callback signature.' });
  }

  const payload = req.body as { body?: { order_id?: string; order_status?: { key?: BogOrderStatusKey } } };
  const bogOrderId = payload.body?.order_id;
  const statusKey = payload.body?.order_status?.key;
  if (!bogOrderId || !statusKey) {
    return res.status(400).json({ message: 'Malformed callback payload.' });
  }

  const bogPayment = await prisma.bogPayment.findUnique({ where: { bogOrderId } });
  if (!bogPayment) {
    // Signature was valid but we don't recognize this order — ack anyway so
    // BOG doesn't retry forever; nothing to reconcile on our side.
    return res.status(200).json({ received: true });
  }
  if (bogPayment.status !== 'PENDING') {
    return res.status(200).json({ received: true }); // already processed — idempotent no-op
  }

  try {
    await applyBogPaymentResult(bogPayment.id, statusKey, payload);
  } catch (err) {
    console.error('[bog-callback] failed to apply payment result:', err);
    // Caught and reported explicitly — this handler responds with its own
    // status/body instead of throwing, so it never reaches
    // Sentry.setupExpressErrorHandler (see server.ts). A failure here means
    // real money changed hands on BOG's side but the platform (escrow,
    // enrollment, payout) never caught up, which is exactly the kind of
    // error that needs an alert, not just a log line.
    Sentry.captureException(err, { extra: { bogPaymentId: bogPayment.id, bogOrderId, statusKey } });
    // 500 so BOG's retry mechanism re-delivers; grant logic below is
    // idempotent (unique constraints / status guard above) so a retry is safe.
    return res.status(500).json({ message: 'Failed to process callback.' });
  }
  res.status(200).json({ received: true });
});

export async function applyBogPaymentResult(
  bogPaymentId: string,
  statusKey: BogOrderStatusKey,
  rawCallback: unknown
) {
  const terminalFailureStatuses: BogOrderStatusKey[] = ['rejected', 'refunded', 'refunded_partially'];
  if (statusKey !== 'completed' && !terminalFailureStatuses.includes(statusKey)) {
    // Non-terminal (created/processing/auth_requested/blocked/...) — nothing to do yet.
    return;
  }

  if (statusKey !== 'completed') {
    const changed = await prisma.bogPayment.updateMany({
      where: { id: bogPaymentId, status: 'PENDING' },
      data: { status: 'FAILED', rawCallback: rawCallback as any },
    });
    if (!changed.count) return;
    const failedPayment = await prisma.bogPayment.findUniqueOrThrow({ where: { id: bogPaymentId } });
    // Whatever part of a gift card balance this checkout had spent goes
    // back on the card (runs once: only the PENDING -> FAILED winner gets here).
    await releaseGiftCardHold(failedPayment);
    // A mentorship booking is created up-front at checkout (before payment
    // completes) so the chosen slot survives the BOG redirect round-trip —
    // but that means a declined card / abandoned checkout otherwise leaves
    // a SCHEDULED booking with no payment behind it, permanently blocking
    // the slot for everyone else (assertSlotAvailable/generateMentorSlots
    // only ever check status != CANCELLED, never payment status). Cancel it
    // here so the slot frees up the moment BOG reports the payment as
    // terminally failed, not just when it happens to succeed.
    if (failedPayment.purpose === 'MENTORSHIP') {
      await prisma.mentorshipBooking.updateMany({
        where: { bogPaymentId: failedPayment.id, status: 'SCHEDULED' },
        data: { status: 'CANCELLED' },
      });
    } else if (failedPayment.purpose === 'GIFT_CARD') {
      await cancelGiftCardPurchase(failedPayment.referenceId);
    } else if (failedPayment.purpose === 'HR_SUPPORT') {
      // Same reasoning as MENTORSHIP above — the request row is created
      // up-front (see routes/payments/'s checkout/hr-support route) so a
      // declined card doesn't leave it stuck showing as pending forever.
      await prisma.hRSupportRequest.updateMany({
        where: { id: failedPayment.referenceId, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED' },
      });
    }
    return;
  }

  if (await completeLearningPayment('BOG', bogPaymentId, rawCallback)) return;

  const bogPayment = await prisma.bogPayment.update({
    where: { id: bogPaymentId },
    data: { status: 'COMPLETED', completedAt: new Date(), rawCallback: rawCallback as any },
  });

  if (bogPayment.purpose === 'COURSE') {
    // Only notify on the genuine first completion — a retried/duplicate
    // webhook delivery for an already-enrolled purchase must not resend it,
    // and must not double-credit the instructor either (see
    // courseSaleService.ts's atomic claim).
    const { isNewEnrollment, course } = await completeCoursePurchase({
      userId: bogPayment.userId,
      courseId: bogPayment.referenceId,
      amount: bogPayment.amount + bogPayment.giftCardAmount,
    });
    if (isNewEnrollment && course) await notifyCourseEnrollment(bogPayment.userId, course);
  } else if (bogPayment.purpose === 'GIG_ESCROW_FUNDING') {
    const gig = await prisma.gig.findUnique({ where: { id: bogPayment.referenceId } });
    if (!gig || !gig.assignedFreelancerId) return;
    const existingTransaction = await prisma.gigTransaction.findUnique({ where: { gigId: gig.id } });
    if (existingTransaction) return; // already funded — safe no-op on retry
    const application = await prisma.gigApplication.findFirst({
      where: { gigId: gig.id, applicantId: gig.assignedFreelancerId, status: 'accepted' },
    });
    if (!application) return;
    await captureEscrow({
      gigId: gig.id,
      gigApplicationId: application.id,
      clientId: gig.postedById,
      freelancerId: gig.assignedFreelancerId,
      grossAmount: bogPayment.amount,
      currency: bogPayment.currency,
      providerRef: bogPayment.bogOrderId,
    });
  }
  else if (bogPayment.purpose === 'MENTORSHIP') {
    const booking = await prisma.mentorshipBooking.findUnique({
      where: { bogPaymentId: bogPayment.id },
      include: { mentor: { select: { name: true, email: true } }, student: { select: { name: true, email: true } } },
    });
    // Should always exist (created alongside the BogPayment at checkout) —
    // if genuinely missing there's nothing to put on a calendar.
    if (!booking) return;

    try {
      // Places the payment into escrow — does NOT credit the mentor yet.
      // See mentorshipEscrowService.ts's own comment for the full release
      // lifecycle (student confirmation, 24h auto-release, or admin
      // dispute resolution).
      await captureMentorshipEscrow({ bookingId: booking.id, grossAmount: bogPayment.amount });
    } catch (err) {
      // Never silently drop a real capture failure — the calendar/email
      // steps below are still best-effort, but the mentor's eventual
      // payout must not fail silently, so this is logged loudly for
      // follow-up. AUDIT NOTE (fixed): console.error alone means a
      // transient DB hiccup here leaves the booking paid-but-unescrowed
      // with nothing alerting anyone to retry it — Sentry now captures it
      // the same way the outer callback handler does for a top-level failure.
      console.error('[bog-callback] Failed to capture mentorship escrow:', err);
      Sentry.captureException(err, { extra: { bogPaymentId: bogPayment.id, bookingId: booking.id, stage: 'captureMentorshipEscrow' } });
    }

    let meetLink: string | null = null;
    try {
      const event = await createMentorshipCalendarEvent({
        studentEmail: booking.student.email,
        studentName: booking.student.name,
        studentPhone: booking.studentPhone,
        mentorEmail: booking.mentor.email,
        mentorName: booking.mentor.name,
        scheduledAt: booking.scheduledAt,
        durationMinutes: DEFAULT_SESSION_MINUTES,
        consultationDescription: booking.consultationDescription,
      });
      meetLink = event.meetLink;
      await prisma.mentorshipBooking.update({
        where: { id: booking.id },
        data: { googleEventId: event.eventId, googleMeetLink: event.meetLink, calendarSyncError: null },
      });
    } catch (err) {
      // Payment already succeeded and the booking record exists either way —
      // a calendar failure (not configured, API error) is recorded for an
      // admin to follow up on, never rolled back into a failed payment.
      const message = err instanceof Error ? err.message : 'Calendar event creation failed.';
      console.error('[bog-callback] Google Calendar event creation failed:', message);
      await prisma.mentorshipBooking.update({ where: { id: booking.id }, data: { calendarSyncError: message } });
    }

    // Mentor/student/admin confirmation emails fire regardless of whether
    // the calendar sync above succeeded — meetLink is just null in the
    // email if it didn't, never a reason to drop the confirmation entirely.
    try {
      await sendMentorshipBookingEmails({
        bookingId: booking.id,
        mentorName: booking.mentor.name,
        mentorEmail: booking.mentor.email,
        studentName: booking.student.name,
        studentEmail: booking.student.email,
        studentPhone: booking.studentPhone,
        scheduledAt: booking.scheduledAt,
        durationMinutes: DEFAULT_SESSION_MINUTES,
        meetLink,
        consultationDescription: booking.consultationDescription,
      });
    } catch (err) {
      console.error('[bog-callback] Mentorship booking emails failed:', err);
    }
  } else if (bogPayment.purpose === 'PRODUCT') {
    // Completes the purchase and, for a product with a real external
    // creator, credits their 80% net share — see productSaleService.ts.
    await completeProductPurchase({
      userId: bogPayment.userId,
      productId: bogPayment.referenceId,
      amount: bogPayment.amount + bogPayment.giftCardAmount,
    });
  } else if (bogPayment.purpose === 'LIVE_TRAINING') {
    // Idempotent on retry — see completeLiveTrainingPurchase's own comment.
    await completeLiveTrainingPurchase({ userId: bogPayment.userId, liveTrainingId: bogPayment.referenceId });
  } else if (bogPayment.purpose === 'ENGLISH_TUTOR_SUBSCRIPTION') {
    await completeTutorSubscriptionPurchase(bogPayment.userId);
  } else if (bogPayment.purpose === 'EDUCATOR_VIP') {
    await completeEducatorVipPurchase(bogPayment.userId);
  } else if (bogPayment.purpose === 'BUSINESS_AI_AGENT') {
    const done = await completeAgentPurchase(bogPayment.referenceId);
    if (!done) console.warn(`[bog-callback] Business AI agent ${bogPayment.referenceId} was deleted before payment ${bogPayment.id} completed.`);
  } else if (bogPayment.purpose === 'CHILDRENS_BOOK') {
    // Idempotent on retry — the underlying updateMany only ever matches a
    // book still in PAYMENT_PENDING (see bookPurchaseFulfillment.ts).
    // Generation then starts in the background right away — a paid book
    // never waits for the user to press a button (and a failure to start
    // here is retried by the startup resume sweep / the user's Retry).
    const { handled } = await completeChildrensBookPurchase({ bookProjectId: bogPayment.referenceId });
    if (handled) {
      await startFinalGeneration(bogPayment.referenceId).catch((err) => console.error('[bog-callback] Failed to start children\'s book generation:', err));
    }
  } else if (bogPayment.purpose === 'BOOK_ANIMATION') {
    // Idempotent: only a PAYMENT_PENDING animation moves to QUEUED; the
    // render starts in the background (bookAnimationService.ts).
    await completeBookAnimationPurchase({ bookProjectId: bogPayment.referenceId, paidVia: 'BOG' });
  } else if (bogPayment.purpose === 'GIFT_CARD') {
    // Mints the code and emails the recipient now (or on the chosen date).
    // Idempotent on retry — see giftCardService.fulfillGiftCardPurchase.
    await fulfillGiftCardPurchase(bogPayment.referenceId);
  } else if (bogPayment.purpose === 'HR_SUPPORT') {
    // Places the payment into escrow — does NOT credit a specialist yet
    // (none is assigned at this point). See hrSupportEscrowService.ts's own
    // comment for the full release lifecycle.
    try {
      await captureHRSupportEscrow({ requestId: bogPayment.referenceId, grossAmount: bogPayment.amount });
    } catch (err) {
      // Same reasoning as the mentorship capture above — a failure here
      // leaves the request paid-but-unescrowed with no specialist payout
      // ever able to happen, so it needs a real alert, not just a log line.
      console.error('[bog-callback] Failed to capture HR Assistance escrow:', err);
      Sentry.captureException(err, { extra: { bogPaymentId: bogPayment.id, requestId: bogPayment.referenceId, stage: 'captureHRSupportEscrow' } });
    }

    const hrRequest = await prisma.hRSupportRequest.findUnique({
      where: { id: bogPayment.referenceId },
      include: { vacancy: { select: { title: true } }, requestedBy: { select: { name: true, email: true } } },
    });
    if (hrRequest) {
      try {
        await sendHRSupportRequestAlertEmail({
          requestId: hrRequest.id,
          vacancyTitle: hrRequest.vacancy.title,
          employerName: hrRequest.requestedBy.name,
          employerEmail: hrRequest.requestedBy.email,
          candidateCount: hrRequest.candidateCount,
          grossAmount: hrRequest.grossAmount,
          currency: hrRequest.currency,
        });
      } catch (err) {
        console.error('[bog-callback] HR Assistance alert email failed:', err);
      }
    }
  }
}

// ============================================================
// STATUS POLLING — used by the frontend's post-redirect result page while
// waiting for the async callback to land.
// ============================================================
router.get('/bog/status/:paymentId', authenticate, async (req: Request, res: Response) => {
  const bogPayment = await prisma.bogPayment.findUnique({ where: { id: req.params.paymentId } });
  if (!bogPayment || bogPayment.userId !== req.user!.id) {
    return res.status(404).json({ message: 'Payment not found.' });
  }

  if (bogPayment.status === 'PENDING' && !bogPayment.bogOrderId.startsWith('pending-')) {
    try {
      const details = await getBogOrderDetails(bogPayment.bogOrderId);
      await applyBogPaymentResult(bogPayment.id, details.order_status.key, { reconciledFrom: 'status-poll', details });
    } catch (err) {
      console.error('[bog-status] reconciliation fetch failed:', err);
    }
  }

  const fresh = await prisma.bogPayment.findUnique({ where: { id: bogPayment.id } });

  // Mentorship purchases: surface the booking's scheduled time + Meet link
  // once the callback (or this poll's own reconciliation above) has created
  // the calendar event, so the result page can show a real confirmation
  // instead of just a generic "payment completed".
  let booking: { scheduledAt: Date; googleMeetLink: string | null; calendarSyncError: string | null } | null = null;
  if (fresh!.purpose === 'MENTORSHIP') {
    booking = await prisma.mentorshipBooking.findUnique({
      where: { bogPaymentId: fresh!.id },
      select: { scheduledAt: true, googleMeetLink: true, calendarSyncError: true },
    });
  }

  res.json({
    data: {
      id: fresh!.id,
      status: fresh!.status,
      purpose: fresh!.purpose,
      referenceId: fresh!.referenceId,
      amount: fresh!.amount,
      currency: fresh!.currency,
      booking,
    },
  });
});

export default router;
