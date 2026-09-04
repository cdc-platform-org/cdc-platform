import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { checkoutMentorshipSchema } from '../schemas/paymentSchemas';
import { requestHRSupportSchema } from '../schemas/hrSupportSchemas';
import { calculateHRSupportFee } from '../services/hrPricingService';
import { captureHRSupportEscrow } from '../services/hrSupportEscrowService';
import {
  createBogOrder,
  getBogOrderDetails,
  verifyBogCallbackSignature,
  BogOrderStatusKey,
  BogNotConfiguredError,
  CreateBogOrderParams,
  CreateBogOrderResult,
} from '../services/bogPaymentService';
import { captureEscrow } from '../services/escrowService';
import { completeProductPurchase } from '../services/productSaleService';
import { completeCoursePurchase } from '../services/courseSaleService';
import { paymentModelForPurpose } from '../services/paymentModel';
import { getCurrentPrice } from '../services/coursePricing';
import { getCurrentProductPrice } from '../services/productPricing';
import { applyPromoToCheckout, recordPromoRedemption, PromoCodeError } from '../services/couponService';
import { assertSlotAvailable, SlotUnavailableError, DEFAULT_SESSION_MINUTES } from '../services/mentorAvailabilityService';
import { createMentorshipCalendarEvent } from '../services/googleCalendarService';
import { captureMentorshipEscrow } from '../services/mentorshipEscrowService';
import { sendMentorshipBookingEmails, sendHRSupportRequestAlertEmail } from '../services/emailService';
import { notifyCourseEnrollment } from '../services/courseEnrollmentNotification';
import { completeLiveTrainingPurchase } from '../services/liveTrainingSaleService';
import { completeTutorSubscriptionPurchase, TUTOR_SUBSCRIPTION_PRICE_GEL } from '../services/englishTutorSubscriptionService';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// Applied to the four checkout-initiating routes below (not /bog/callback,
// which is BOG's own webhook and must not be throttled, and not /my or
// /bog/status which are just reads) — same in-memory/IP-keyed limiter as
// the rest of this app (see middleware/rateLimit.ts), sized to stop a
// scripted burst of order creation without getting in the way of a real
// user retrying a failed checkout a few times.
const checkoutRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many checkout attempts. Please wait a moment and try again.',
});

// BOG's create-order API rejects (or silently fails to reach) a callback_url
// that isn't a real public https:// endpoint — a plain http:// URL, or the
// http://localhost:PORT fallback this resolves to when BACKEND_URL isn't
// set as an env var, both do exactly that. Root cause of that exact
// failure was BACKEND_URL never being set as an Azure App Setting (fixed
// there directly); this coercion is the defensive backstop so a future
// missing/malformed BACKEND_URL degrades to "still a valid https:// URL
// for this backend" instead of silently breaking every payment.
function resolveHttpsCallbackUrl(): string {
  const raw = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  const httpsBase = raw.startsWith('https://') ? raw : `https://${raw.replace(/^https?:\/\//, '')}`;
  return `${httpsBase}/api/payments/bog/callback`;
}
const CALLBACK_URL = resolveHttpsCallbackUrl();

// Optional UI-language hint from the client (courses/[id], store/[id], etc.
// all read Next.js's router.locale and send it here) — sanitized down to
// "ka"/"en" inside bogPaymentService.createBogOrder() before it ever reaches
// BOG's API, so a missing/malformed value here is never a security issue.
function checkoutLang(req: Request): string | undefined {
  return typeof req.body?.lang === 'string' ? req.body.lang : undefined;
}

function resultRedirects(paymentId: string) {
  return {
    successRedirectUrl: `${FRONTEND_URL}/payments/bog/result?paymentId=${paymentId}`,
    failRedirectUrl: `${FRONTEND_URL}/payments/bog/result?paymentId=${paymentId}&status=fail`,
  };
}

// Without this, any createBogOrder failure (missing credentials, BOG
// rejecting the request, a network error) fell through to the global error
// handler's generic "Server error" — unhelpful for diagnosing exactly what
// went wrong (e.g. a non-HTTPS callback URL, which is what BOG's API
// actually reports). 501 for "not configured" (matches the pattern used by
// Bunny/Gemini elsewhere in this codebase), 502 for BOG rejecting or being
// unreachable — both with BOG's own message surfaced, not swallowed.
// Reuses a still-fresh PENDING order for the same user+purpose+reference
// instead of creating a new one, so a double-click or an accidental form
// resubmit doesn't create two BOG orders (and risk the buyer being charged
// twice if they complete both). 15 minutes comfortably covers a duplicate
// click without indefinitely blocking a genuinely abandoned/expired attempt.
const PENDING_ORDER_REUSE_WINDOW_MS = 15 * 60 * 1000;

async function findReusablePendingOrder(
  userId: string,
  purpose: 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING' | 'PRODUCT' | 'HR_SUPPORT' | 'LIVE_TRAINING' | 'ENGLISH_TUTOR_SUBSCRIPTION',
  referenceId: string
) {
  const existing = await prisma.bogPayment.findFirst({
    where: { userId, purpose, referenceId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && existing.redirectUrl && Date.now() - existing.createdAt.getTime() < PENDING_ORDER_REUSE_WINDOW_MS) {
    return existing;
  }
  return null;
}

async function createBogOrderOrRespond(res: Response, params: CreateBogOrderParams): Promise<CreateBogOrderResult | null> {
  try {
    return await createBogOrder(params);
  } catch (err) {
    // Logged here explicitly — this catch responds directly rather than
    // re-throwing, so it never reaches the global errorHandler's own
    // console.error. The response message (BOG's exact status/body, from
    // bogPaymentService's error text — e.g. invalid client_id/secret,
    // non-HTTPS callback_url, bad merchant config) is safe to show an
    // admin/developer since this only ever fires for BOG API failures,
    // never end-user input.
    console.error('[bog] createBogOrder failed:', err instanceof Error ? err.message : err);
    if (err instanceof BogNotConfiguredError) {
      res.status(501).json({ message: err.message });
    } else {
      res.status(502).json({ message: err instanceof Error ? err.message : 'Payment gateway request failed.' });
    }
    return null;
  }
}

// ============================================================
// CHECKOUT — COURSE
// ============================================================
router.post(
  '/checkout/course/:courseId',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course || course.status !== 'PUBLISHED') {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
    });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'You are already enrolled in this course.' });
    }
    if (course.maxCapacity != null) {
      const enrolledCount = await prisma.courseEnrollment.count({ where: { courseId: course.id } });
      if (enrolledCount >= course.maxCapacity) {
        return res.status(409).json({ message: 'This course is full.' });
      }
    }
    const reusable = await findReusablePendingOrder(req.user!.id, 'COURSE', course.id);
    if (reusable) {
      return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });
    }

    // Charges whatever the course actually costs right now — if it's on an
    // active sale, that's the discounted price, not originalPrice.
    let chargeAmount = getCurrentPrice(course);

    // Admin/manager/moderator test-mode bypass — lets the admin team QA the
    // full enroll flow (notification, dashboard entry, /learn access) for
    // free rather than needing a real BOG charge on every test pass. Gated
    // on the DB's own adminRole, never a client-sent flag. Always on for an
    // admin-team member (no separate opt-in), same unconditional posture as
    // checkCourseAccess()'s existing free-view bypass for admins — an admin
    // account is simply never charged here; use a non-admin test account to
    // exercise the real BOG path.
    const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
    if (requesterAdminRole) chargeAmount = 0;

    // Optional promo code — re-validated here rather than trusting whatever
    // discountedAmount the client saw from POST /promos/validate, so a
    // tampered/stale client value can never under-charge. See
    // couponService.ts's applyPromoToCheckout for the shared discount/
    // targeting rule every checkout route (course/live-training/product/
    // AI-tool, BOG + Stripe) now uses. currentUses is only incremented once
    // the BOG order is actually created below (not just because a code was
    // typed in); promoCodeId is recorded on the BogPayment itself, so an
    // abandoned checkout still "spends" a use but is at least traceable to
    // the specific attempt.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: { id: string } | null = null;
    if (rawPromoCode) {
      try {
        const applied = await applyPromoToCheckout(rawPromoCode, 'COURSE', course.id, chargeAmount);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    // A 100% discount promo code can bring the charge to 0 — BOG's gateway
    // isn't a real payment at that point (some gateways reject a 0-amount
    // order outright, others behave unpredictably), so this bypasses it
    // entirely: the enrollment is granted immediately and the BogPayment
    // row is recorded already COMPLETED for a consistent payment-history/
    // invoice trail, same shape as a real paid enrollment just at 0 GEL.
    if (chargeAmount <= 0) {
      const freePayment = await prisma.bogPayment.create({
        data: {
          bogOrderId: `promo-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'COURSE',
          paymentModel: paymentModelForPurpose('COURSE'),
          referenceId: course.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
          promoCodeId: appliedPromo?.id ?? null,
        },
      });
      const { isNewEnrollment } = await completeCoursePurchase({ userId: req.user!.id, courseId: course.id, amount: 0 });
      if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
      if (isNewEnrollment) await notifyCourseEnrollment(req.user!.id, course);
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'COURSE',
        paymentModel: paymentModelForPurpose('COURSE'),
        referenceId: course.id,
        amount: chargeAmount,
        currency: 'GEL',
        status: 'PENDING',
        promoCodeId: appliedPromo?.id ?? null,
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: course.title,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) return;
    if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

// ============================================================
// CHECKOUT — LIVE TRAINING
// Authenticated self-serve alternative to the anonymous phone-lead form
// (POST /live-trainings/:id/register) for a PRICED training. Added to fix
// a real bug: POST /live-trainings/:id/enroll used to grant an ACTIVE
// LiveTrainingEnrollment (and the frontend's "You are enrolled!" banner)
// unconditionally, with no price/payment check at all — that route is now
// free-trainings-only (see liveTrainings.ts), and a priced training must
// go through this checkout instead. No promo-code support (live trainings
// have no promo system) and no instructor payout (see
// liveTrainingSaleService.ts's own comment) — otherwise the same shape as
// CHECKOUT — COURSE above.
// ============================================================
router.post(
  '/checkout/live-training/:id',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const training = await prisma.liveTraining.findFirst({
      where: { id: req.params.id, published: true },
      include: { _count: { select: { leads: true, enrollments: { where: { status: 'ACTIVE' } } } } },
    });
    if (!training) return res.status(404).json({ message: 'Live training not found.' });
    if (!training.price || training.price <= 0) {
      return res.status(400).json({ message: 'This training is free — enroll directly instead of checking out.' });
    }

    const existingEnrollment = await prisma.liveTrainingEnrollment.findUnique({
      where: { userId_liveTrainingId: { userId: req.user!.id, liveTrainingId: training.id } },
    });
    if (existingEnrollment?.status === 'ACTIVE') {
      return res.status(400).json({ message: 'You are already enrolled in this training.' });
    }
    if (!existingEnrollment && training._count.leads + training._count.enrollments >= training.maxCapacity) {
      return res.status(409).json({ message: 'This training is fully booked.' });
    }

    const reusable = await findReusablePendingOrder(req.user!.id, 'LIVE_TRAINING', training.id);
    if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

    // Same admin/manager/moderator free test-mode bypass as CHECKOUT — COURSE
    // above — never a client-sent flag, always derived from the DB's own
    // adminRole.
    let chargeAmount = training.price;
    const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
    if (requesterAdminRole) chargeAmount = 0;

    // Same re-validated-server-side promo handling as CHECKOUT — COURSE —
    // see couponService.ts's applyPromoToCheckout.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: { id: string } | null = null;
    if (rawPromoCode && chargeAmount > 0) {
      try {
        const applied = await applyPromoToCheckout(rawPromoCode, 'LIVE_TRAINING', training.id, chargeAmount);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    if (chargeAmount <= 0) {
      const freePayment = await prisma.bogPayment.create({
        data: {
          bogOrderId: `admin-test-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'LIVE_TRAINING',
          paymentModel: paymentModelForPurpose('LIVE_TRAINING'),
          referenceId: training.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
          promoCodeId: appliedPromo?.id ?? null,
        },
      });
      await completeLiveTrainingPurchase({ userId: req.user!.id, liveTrainingId: training.id });
      if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'LIVE_TRAINING',
        paymentModel: paymentModelForPurpose('LIVE_TRAINING'),
        referenceId: training.id,
        amount: chargeAmount,
        currency: 'GEL',
        status: 'PENDING',
        promoCodeId: appliedPromo?.id ?? null,
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: training.title,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) return;
    if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

// ============================================================
// CHECKOUT — ENGLISH TUTOR (IMIAKO) SUBSCRIPTION
// A flat 50 GEL/month access purchase — no target row to look up (unlike
// every other purpose above), referenceId is just the buyer's own User.id.
// No promo codes, no capacity check, no instructor payout — the simplest
// checkout in this file. See englishTutorSubscriptionService.ts's own
// comment for why this is a plain one-time purchase, not a real recurring
// charge.
// ============================================================
router.post(
  '/checkout/english-tutor',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const reusable = await findReusablePendingOrder(req.user!.id, 'ENGLISH_TUTOR_SUBSCRIPTION', req.user!.id);
    if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

    const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
    let chargeAmount = requesterAdminRole ? 0 : TUTOR_SUBSCRIPTION_PRICE_GEL;

    // Same re-validated-server-side promo handling as CHECKOUT — COURSE —
    // see couponService.ts's applyPromoToCheckout. AI_TOOL targetId
    // 'english-tutor' — see couponService.ts's resolveTargetPrice.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: { id: string } | null = null;
    if (rawPromoCode && chargeAmount > 0) {
      try {
        const applied = await applyPromoToCheckout(rawPromoCode, 'AI_TOOL', 'english-tutor', chargeAmount);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    if (chargeAmount <= 0) {
      const freePayment = await prisma.bogPayment.create({
        data: {
          bogOrderId: `admin-test-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
          paymentModel: paymentModelForPurpose('ENGLISH_TUTOR_SUBSCRIPTION'),
          referenceId: req.user!.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
          promoCodeId: appliedPromo?.id ?? null,
        },
      });
      await completeTutorSubscriptionPurchase(req.user!.id);
      if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
        paymentModel: paymentModelForPurpose('ENGLISH_TUTOR_SUBSCRIPTION'),
        referenceId: req.user!.id,
        amount: chargeAmount,
        currency: 'GEL',
        status: 'PENDING',
        promoCodeId: appliedPromo?.id ?? null,
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: 'IMIAKO — AI English Tutor (1 month)',
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) return;
    if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

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

// ============================================================
// CHECKOUT — GIG ESCROW FUNDING
// Replaces the dev-only POST /api/gigs/:id/test-capture-escrow simulation
// with a real BOG payment; on callback success this funds the same
// escrowService.captureEscrow() used by that test route.
// ============================================================
router.post(
  '/checkout/gig/:gigId',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const gig = await prisma.gig.findUnique({ where: { id: req.params.gigId } });
    if (!gig) return res.status(404).json({ message: 'Gig not found.' });
    if (gig.postedById !== req.user!.id) {
      return res.status(403).json({ message: 'Only the gig owner can fund escrow for this gig.' });
    }
    if (gig.status !== 'assigned' || !gig.assignedFreelancerId) {
      return res.status(400).json({ message: 'Gig must be in "assigned" status with a freelancer to fund escrow.' });
    }
    const existingTransaction = await prisma.gigTransaction.findUnique({ where: { gigId: gig.id } });
    if (existingTransaction) {
      return res.status(400).json({ message: 'Escrow has already been funded for this gig.' });
    }
    const application = await prisma.gigApplication.findFirst({
      where: { gigId: gig.id, applicantId: gig.assignedFreelancerId, status: 'accepted' },
    });
    if (!application) {
      return res.status(400).json({ message: 'No accepted application found for this gig.' });
    }
    const reusableEscrow = await findReusablePendingOrder(req.user!.id, 'GIG_ESCROW_FUNDING', gig.id);
    if (reusableEscrow) {
      return res.status(200).json({ paymentId: reusableEscrow.id, redirectUrl: reusableEscrow.redirectUrl });
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'GIG_ESCROW_FUNDING',
        paymentModel: paymentModelForPurpose('GIG_ESCROW_FUNDING'),
        referenceId: gig.id,
        amount: application.bidAmount,
        currency: 'GEL',
        status: 'PENDING',
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: application.bidAmount,
      currency: 'GEL',
      basketItemName: `Escrow funding: ${gig.title}`,
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

// ============================================================
// CHECKOUT — HR ASSISTANCE
// GEL-only for this MVP (no Stripe path yet) — see the pricing report this
// feature was speced from. Creates the HRSupportRequest AND snapshots every
// current VacancyApplication into a CandidateEvaluation row up front (see
// the candidateCount comment on the model) — both must exist before
// checkout so the price shown in the pre-purchase modal is exactly what's
// charged, with no gap for the applicant pool to change underneath it.
// ============================================================
router.post(
  '/checkout/hr-support/:vacancyId',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const result = requestHRSupportSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });

    const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.vacancyId } });
    if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
    if (vacancy.postedById !== req.user!.id) {
      return res.status(403).json({ message: 'Only the vacancy owner can request HR Assistance.' });
    }

    const applications = await prisma.vacancyApplication.findMany({ where: { vacancyId: vacancy.id } });
    if (applications.length === 0) {
      return res.status(400).json({ message: 'This vacancy has no applicants to screen yet.' });
    }

    const grossAmount = calculateHRSupportFee(applications.length);
    const hrRequest = await prisma.hRSupportRequest.create({
      data: {
        vacancyId: vacancy.id,
        requestedById: req.user!.id,
        candidateCount: applications.length,
        grossAmount,
        currency: 'GEL',
        tosAcceptedAt: new Date(),
        candidateEvaluations: {
          create: applications.map((application) => ({ applicationId: application.id })),
        },
      },
    });

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'HR_SUPPORT',
        paymentModel: paymentModelForPurpose('HR_SUPPORT'),
        referenceId: hrRequest.id,
        amount: grossAmount,
        currency: 'GEL',
        status: 'PENDING',
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: grossAmount,
      currency: 'GEL',
      basketItemName: `HR Assistance: ${vacancy.title}`,
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

// ============================================================
// CHECKOUT — DIGITAL PRODUCT
// ============================================================
router.post(
  '/checkout/product/:productId',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (product.price <= 0) {
      return res.status(400).json({ message: 'This product is free — claim it directly instead of checking out.' });
    }
    // The actual charged amount when a discount is active — the platform's
    // 20% commission (productSaleService.ts) applies to whatever this is,
    // never the original price, so a 5 GEL sale nets the creator 4 GEL.
    let chargeAmount = getCurrentProductPrice(product);
    const existingPurchase = await prisma.productPurchase.findUnique({
      where: { userId_productId: { userId: req.user!.id, productId: product.id } },
    });
    if (existingPurchase?.paymentStatus === 'COMPLETED') {
      return res.status(400).json({ message: 'You already own this product.' });
    }
    const reusable = await findReusablePendingOrder(req.user!.id, 'PRODUCT', product.id);
    if (reusable) {
      return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });
    }

    // Admin/manager/moderator test-mode bypass — same reasoning and posture
    // as the course checkout's own bypass above: unconditional for any
    // admin-team account, gated on the DB's adminRole. amount: 0 means the
    // creator (if any) is correctly credited nothing — this is a QA pass,
    // not a real sale, so there's no real revenue to split.
    const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
    if (requesterAdminRole) {
      const freePayment = await prisma.bogPayment.create({
        data: {
          bogOrderId: `admin-test-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'PRODUCT',
          paymentModel: paymentModelForPurpose('PRODUCT'),
          referenceId: product.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      await completeProductPurchase({ userId: req.user!.id, productId: product.id, amount: 0 });
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, purchased: true });
    }

    // Same re-validated-server-side promo handling as CHECKOUT — COURSE —
    // see couponService.ts's applyPromoToCheckout.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: { id: string } | null = null;
    if (rawPromoCode) {
      try {
        const applied = await applyPromoToCheckout(rawPromoCode, 'DIGITAL_PRODUCT', product.id, chargeAmount);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    if (chargeAmount <= 0) {
      const freePayment = await prisma.bogPayment.create({
        data: {
          bogOrderId: `promo-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'PRODUCT',
          paymentModel: paymentModelForPurpose('PRODUCT'),
          referenceId: product.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
          promoCodeId: appliedPromo?.id ?? null,
        },
      });
      await completeProductPurchase({ userId: req.user!.id, productId: product.id, amount: 0 });
      if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, purchased: true });
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'PRODUCT',
        paymentModel: paymentModelForPurpose('PRODUCT'),
        referenceId: product.id,
        amount: chargeAmount,
        currency: 'GEL',
        status: 'PENDING',
        promoCodeId: appliedPromo?.id ?? null,
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: product.title,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
      lang: checkoutLang(req),
    });
    if (!order) return;
    if (appliedPromo) await recordPromoRedemption(appliedPromo.id);
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

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
    const failedPayment = await prisma.bogPayment.update({
      where: { id: bogPaymentId },
      data: { status: 'FAILED', rawCallback: rawCallback as any },
    });
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
    } else if (failedPayment.purpose === 'HR_SUPPORT') {
      // Same reasoning as MENTORSHIP above — the request row is created
      // up-front (see routes/payments.ts's checkout/hr-support route) so a
      // declined card doesn't leave it stuck showing as pending forever.
      await prisma.hRSupportRequest.updateMany({
        where: { id: failedPayment.referenceId, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED' },
      });
    }
    return;
  }

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
      amount: bogPayment.amount,
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
      // follow-up.
      console.error('[bog-callback] Failed to capture mentorship escrow:', err);
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
      amount: bogPayment.amount,
    });
  } else if (bogPayment.purpose === 'LIVE_TRAINING') {
    // Idempotent on retry — see completeLiveTrainingPurchase's own comment.
    await completeLiveTrainingPurchase({ userId: bogPayment.userId, liveTrainingId: bogPayment.referenceId });
  } else if (bogPayment.purpose === 'ENGLISH_TUTOR_SUBSCRIPTION') {
    await completeTutorSubscriptionPurchase(bogPayment.userId);
  } else if (bogPayment.purpose === 'HR_SUPPORT') {
    // Places the payment into escrow — does NOT credit a specialist yet
    // (none is assigned at this point). See hrSupportEscrowService.ts's own
    // comment for the full release lifecycle.
    try {
      await captureHRSupportEscrow({ requestId: bogPayment.referenceId, grossAmount: bogPayment.amount });
    } catch (err) {
      console.error('[bog-callback] Failed to capture HR Assistance escrow:', err);
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

// ============================================================
// MY PAYMENT HISTORY — self-serve, for the dashboard. Every BogPayment row
// is a real completed-or-attempted BOG order across all three checkout
// flows (course/mentorship/gig-escrow) — referenceId is a polymorphic
// pointer (see the model's own comment), so for COURSE purchases a
// best-effort course title is resolved and attached; the other two
// purposes are self-descriptive already (mentorship's referenceId is
// already a free-text package label, gig-escrow's title isn't critical
// here since the Gigs tab covers that relationship in full).
// ============================================================
router.get('/my', authenticate, async (req: Request, res: Response) => {
  // Merges both gateways' rows into one history list — a user who paid via
  // Stripe for one purchase and BOG for another should see both, not just
  // whichever table this happened to query first.
  const [bogPayments, stripePayments] = await Promise.all([
    prisma.bogPayment.findMany({
      where: { userId: req.user!.id },
      include: { promoCode: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stripePayment.findMany({
      where: { userId: req.user!.id },
      include: { promoCode: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const payments = [
    ...bogPayments.map((p) => ({ ...p, gateway: 'BOG' as const })),
    ...stripePayments.map((p) => ({ ...p, gateway: 'STRIPE' as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const courseIds = payments.filter((p) => p.purpose === 'COURSE').map((p) => p.referenceId);
  const courses = courseIds.length
    ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } })
    : [];
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  const productIds = payments.filter((p) => p.purpose === 'PRODUCT').map((p) => p.referenceId);
  const products = productIds.length
    ? await prisma.digitalProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } })
    : [];
  const productTitleById = new Map(products.map((p) => [p.id, p.title]));

  // HR_SUPPORT's referenceId is the HRSupportRequest.id, not the vacancy
  // itself — one extra hop via the request to get to a real title.
  const hrRequestIds = payments.filter((p) => p.purpose === 'HR_SUPPORT').map((p) => p.referenceId);
  const hrRequests = hrRequestIds.length
    ? await prisma.hRSupportRequest.findMany({
        where: { id: { in: hrRequestIds } },
        select: { id: true, vacancy: { select: { title: true } } },
      })
    : [];
  const hrRequestTitleById = new Map(hrRequests.map((r) => [r.id, r.vacancy.title]));

  res.json({
    data: payments.map((p) => ({
      id: p.id,
      gateway: p.gateway,
      purpose: p.purpose,
      referenceId: p.referenceId,
      referenceTitle:
        p.purpose === 'COURSE'
          ? courseTitleById.get(p.referenceId) ?? null
          : p.purpose === 'PRODUCT'
          ? productTitleById.get(p.referenceId) ?? null
          : p.purpose === 'HR_SUPPORT'
          ? hrRequestTitleById.get(p.referenceId) ?? null
          : null,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      promoCode: p.promoCode?.code ?? null,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    })),
  });
});

export default router;
