import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { checkoutMentorshipSchema } from '../schemas/paymentSchemas';
import {
  createStripeCheckoutSession,
  getStripeCheckoutSession,
  constructStripeWebhookEvent,
  StripeNotConfiguredError,
} from '../services/stripePaymentService';
import { STRIPE_GEL_TO_USD_RATE, STRIPE_GEL_TO_EUR_RATE } from '../utils/env';
import { captureEscrow } from '../services/escrowService';
import { completeProductPurchase } from '../services/productSaleService';
import { completeCoursePurchase } from '../services/courseSaleService';
import { paymentModelForPurpose } from '../services/paymentModel';
import { getCurrentPrice, computeCoursePriceWithPromo } from '../services/coursePricing';
import { getCurrentProductPrice } from '../services/productPricing';
import { assertSlotAvailable, SlotUnavailableError, DEFAULT_SESSION_MINUTES } from '../services/mentorAvailabilityService';
import { createMentorshipCalendarEvent } from '../services/googleCalendarService';
import { captureMentorshipEscrow } from '../services/mentorshipEscrowService';
import { sendMentorshipBookingEmails } from '../services/emailService';
import { notifyCourseEnrollment } from '../services/courseEnrollmentNotification';
import { completeLiveTrainingPurchase } from '../services/liveTrainingSaleService';
import { completeTutorSubscriptionPurchase, TUTOR_SUBSCRIPTION_PRICE_GEL } from '../services/englishTutorSubscriptionService';

// ============================================================
// Stripe Checkout routes — the international-currency (USD/EUR) sibling of
// routes/payments.ts (BOG, GEL/ka). Deliberately a SEPARATE router/table/
// fulfillment function rather than widening the BOG code path: this app has
// no automated test coverage on payments, so the lower-risk choice here is
// duplication over refactoring code real users already depend on. Mounted
// at /api/payments/stripe (see server.ts) so both gateways still share the
// /api/payments/* namespace their frontend callers expect.
// ============================================================

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// Same sizing/reasoning as payments.ts's checkoutRateLimit — a separate
// instance (not shared/imported) since it's simpler than exporting rate
// limiter state across router modules, and the two gateways' checkout
// buttons aren't meant to share one throttle bucket anyway.
const checkoutRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many checkout attempts. Please wait a moment and try again.',
});

type StripePurpose = 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING' | 'PRODUCT' | 'LIVE_TRAINING' | 'ENGLISH_TUTOR_SUBSCRIPTION';
type StripeCurrency = 'USD' | 'EUR';

function resultRedirects(paymentId: string) {
  return {
    successUrl: `${FRONTEND_URL}/payments/stripe/result?paymentId=${paymentId}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${FRONTEND_URL}/payments/stripe/result?paymentId=${paymentId}&status=cancelled`,
  };
}

// Client-selectable, restricted to the two currencies this integration
// supports — anything else falls back to USD rather than erroring, mirroring
// sanitizeBogLang's "never let a malformed hint break checkout" posture.
function checkoutCurrency(req: Request): StripeCurrency {
  return req.body?.currency === 'eur' || req.body?.currency === 'EUR' ? 'EUR' : 'USD';
}

function convertGelToStripeMinorUnits(amountGel: number, currency: StripeCurrency): number {
  const rate = currency === 'EUR' ? STRIPE_GEL_TO_EUR_RATE : STRIPE_GEL_TO_USD_RATE;
  return Math.round(amountGel * rate);
}

const PENDING_ORDER_REUSE_WINDOW_MS = 15 * 60 * 1000;

async function findReusablePendingOrder(userId: string, purpose: StripePurpose, referenceId: string) {
  const existing = await prisma.stripePayment.findFirst({
    where: { userId, purpose, referenceId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && existing.checkoutUrl && Date.now() - existing.createdAt.getTime() < PENDING_ORDER_REUSE_WINDOW_MS) {
    return existing;
  }
  return null;
}

async function createStripeSessionOrRespond(
  res: Response,
  params: Parameters<typeof createStripeCheckoutSession>[0]
): Promise<ReturnType<typeof createStripeCheckoutSession> extends Promise<infer T> ? T | null : never> {
  try {
    return await createStripeCheckoutSession(params);
  } catch (err) {
    console.error('[stripe] createStripeCheckoutSession failed:', err instanceof Error ? err.message : err);
    if (err instanceof StripeNotConfiguredError) {
      res.status(501).json({ message: err.message });
    } else {
      res.status(502).json({ message: err instanceof Error ? err.message : 'Payment gateway request failed.' });
    }
    return null as any;
  }
}

// ============================================================
// CHECKOUT — COURSE
// ============================================================
router.post('/checkout/course/:courseId', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
  if (!course || course.status !== 'PUBLISHED') return res.status(404).json({ message: 'Course not found.' });
  const existingEnrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
  });
  if (existingEnrollment) return res.status(400).json({ message: 'You are already enrolled in this course.' });
  if (course.maxCapacity != null) {
    const enrolledCount = await prisma.courseEnrollment.count({ where: { courseId: course.id } });
    if (enrolledCount >= course.maxCapacity) return res.status(409).json({ message: 'This course is full.' });
  }
  const reusable = await findReusablePendingOrder(req.user!.id, 'COURSE', course.id);
  if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.checkoutUrl });

  let chargeAmountGel = getCurrentPrice(course);
  const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : null;
  let appliedPromo: { id: string } | null = null;
  if (rawPromoCode) {
    const promo = await prisma.promoCode.findUnique({ where: { code: rawPromoCode } });
    if (!promo) return res.status(400).json({ message: 'Invalid promo code.' });
    if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ message: 'This promo code has expired.' });
    if (promo.maxUses && promo.currentUses >= promo.maxUses) return res.status(400).json({ message: 'This promo code has reached its usage limit.' });
    chargeAmountGel = computeCoursePriceWithPromo(course, promo);
    appliedPromo = promo;
  }

  // Admin/manager/moderator test-mode bypass — same posture as routes/
  // payments.ts's identical BOG-side bypass: unconditional for any
  // admin-team account, gated on the DB's adminRole, never a client flag.
  const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  if (requesterAdminRole) chargeAmountGel = 0;

  if (chargeAmountGel <= 0) {
    const freePayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `promo-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'COURSE',
        paymentModel: paymentModelForPurpose('COURSE'),
        referenceId: course.id,
        amount: 0,
        amountGel: chargeAmountGel,
        currency: 'USD',
        status: 'COMPLETED',
        completedAt: new Date(),
        promoCodeId: appliedPromo?.id ?? null,
      },
    });
    const { isNewEnrollment } = await completeCoursePurchase({ userId: req.user!.id, courseId: course.id, amount: chargeAmountGel });
    if (appliedPromo) await prisma.promoCode.update({ where: { id: appliedPromo.id }, data: { currentUses: { increment: 1 } } });
    if (isNewEnrollment) await notifyCourseEnrollment(req.user!.id, course);
    return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
  }

  const currency = checkoutCurrency(req);
  const amount = convertGelToStripeMinorUnits(chargeAmountGel, currency);
  const stripePayment = await prisma.stripePayment.create({
    data: {
      stripeSessionId: `pending-${crypto.randomUUID()}`,
      userId: req.user!.id,
      purpose: 'COURSE',
      paymentModel: paymentModelForPurpose('COURSE'),
      referenceId: course.id,
      amount,
      amountGel: chargeAmountGel,
      currency,
      status: 'PENDING',
      promoCodeId: appliedPromo?.id ?? null,
    },
  });
  const { successUrl, cancelUrl } = resultRedirects(stripePayment.id);
  const session = await createStripeSessionOrRespond(res, {
    externalOrderId: stripePayment.id,
    amount,
    currency: currency.toLowerCase() as 'usd' | 'eur',
    productName: course.title,
    successUrl,
    cancelUrl,
    customerEmail: req.user!.email,
  });
  if (!session) return;
  if (appliedPromo) await prisma.promoCode.update({ where: { id: appliedPromo.id }, data: { currentUses: { increment: 1 } } });
  const updated = await prisma.stripePayment.update({
    where: { id: stripePayment.id },
    data: { stripeSessionId: session.stripeSessionId, checkoutUrl: session.checkoutUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: session.checkoutUrl });
});

// ============================================================
// CHECKOUT — LIVE TRAINING
// International-currency counterpart to payments.ts's /checkout/live-training
// — see that route's own comment for why this exists (closing the "enroll
// grants a paid seat for free" bug). No promo codes, no instructor payout,
// same shape as CHECKOUT — COURSE above otherwise.
// ============================================================
router.post('/checkout/live-training/:id', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
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
  if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.checkoutUrl });

  const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  const chargeAmountGel = requesterAdminRole ? 0 : training.price;

  if (chargeAmountGel <= 0) {
    const freePayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `admin-test-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'LIVE_TRAINING',
        paymentModel: paymentModelForPurpose('LIVE_TRAINING'),
        referenceId: training.id,
        amount: 0,
        amountGel: 0,
        currency: 'USD',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    await completeLiveTrainingPurchase({ userId: req.user!.id, liveTrainingId: training.id });
    return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
  }

  const currency = checkoutCurrency(req);
  const amount = convertGelToStripeMinorUnits(chargeAmountGel, currency);
  const stripePayment = await prisma.stripePayment.create({
    data: {
      stripeSessionId: `pending-${crypto.randomUUID()}`,
      userId: req.user!.id,
      purpose: 'LIVE_TRAINING',
      paymentModel: paymentModelForPurpose('LIVE_TRAINING'),
      referenceId: training.id,
      amount,
      amountGel: chargeAmountGel,
      currency,
      status: 'PENDING',
    },
  });
  const { successUrl, cancelUrl } = resultRedirects(stripePayment.id);
  const session = await createStripeSessionOrRespond(res, {
    externalOrderId: stripePayment.id,
    amount,
    currency: currency.toLowerCase() as 'usd' | 'eur',
    productName: training.title,
    successUrl,
    cancelUrl,
    customerEmail: req.user!.email,
  });
  if (!session) return;
  const updated = await prisma.stripePayment.update({
    where: { id: stripePayment.id },
    data: { stripeSessionId: session.stripeSessionId, checkoutUrl: session.checkoutUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: session.checkoutUrl });
});

// ============================================================
// CHECKOUT — ENGLISH TUTOR (IMIAKO) SUBSCRIPTION
// International-currency counterpart to payments.ts's /checkout/english-tutor
// — see that route's own comment.
// ============================================================
router.post('/checkout/english-tutor', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const reusable = await findReusablePendingOrder(req.user!.id, 'ENGLISH_TUTOR_SUBSCRIPTION', req.user!.id);
  if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.checkoutUrl });

  const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  const chargeAmountGel = requesterAdminRole ? 0 : TUTOR_SUBSCRIPTION_PRICE_GEL;

  if (chargeAmountGel <= 0) {
    const freePayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `admin-test-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
        paymentModel: paymentModelForPurpose('ENGLISH_TUTOR_SUBSCRIPTION'),
        referenceId: req.user!.id,
        amount: 0,
        amountGel: 0,
        currency: 'USD',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    await completeTutorSubscriptionPurchase(req.user!.id);
    return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
  }

  const currency = checkoutCurrency(req);
  const amount = convertGelToStripeMinorUnits(chargeAmountGel, currency);
  const stripePayment = await prisma.stripePayment.create({
    data: {
      stripeSessionId: `pending-${crypto.randomUUID()}`,
      userId: req.user!.id,
      purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
      paymentModel: paymentModelForPurpose('ENGLISH_TUTOR_SUBSCRIPTION'),
      referenceId: req.user!.id,
      amount,
      amountGel: chargeAmountGel,
      currency,
      status: 'PENDING',
    },
  });
  const { successUrl, cancelUrl } = resultRedirects(stripePayment.id);
  const session = await createStripeSessionOrRespond(res, {
    externalOrderId: stripePayment.id,
    amount,
    currency: currency.toLowerCase() as 'usd' | 'eur',
    productName: 'IMIAKO — AI English Tutor (1 month)',
    successUrl,
    cancelUrl,
    customerEmail: req.user!.email,
  });
  if (!session) return;
  const updated = await prisma.stripePayment.update({
    where: { id: stripePayment.id },
    data: { stripeSessionId: session.stripeSessionId, checkoutUrl: session.checkoutUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: session.checkoutUrl });
});

// Same Serializable-transaction-with-one-retry shape as payments.ts's
// createMentorshipCheckoutRecords, and for the same reason — the
// availability check and the booking INSERT must be atomic against each
// other, or two concurrent Stripe checkouts for the same mentor/time can
// both pass assertSlotAvailable and both create a booking.
async function createMentorshipCheckoutRecordsStripe(params: {
  mentorId: string;
  studentId: string;
  scheduledAt: Date;
  amount: number;
  amountGel: number;
  currency: string;
  studentPhone: string;
  consultationDescription?: string;
}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await assertSlotAvailable(params.mentorId, params.scheduledAt, undefined, tx);
          const stripePayment = await tx.stripePayment.create({
            data: {
              stripeSessionId: `pending-${crypto.randomUUID()}`,
              userId: params.studentId,
              purpose: 'MENTORSHIP',
              paymentModel: paymentModelForPurpose('MENTORSHIP'),
              referenceId: params.mentorId,
              amount: params.amount,
              amountGel: params.amountGel,
              currency: params.currency,
              status: 'PENDING',
            },
          });
          const booking = await tx.mentorshipBooking.create({
            data: {
              stripePaymentId: stripePayment.id,
              mentorId: params.mentorId,
              studentId: params.studentId,
              scheduledAt: params.scheduledAt,
              studentPhone: params.studentPhone,
              consultationDescription: params.consultationDescription || null,
            },
          });
          return { stripePayment, booking };
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
// ============================================================
router.post('/checkout/mentorship', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = checkoutMentorshipSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const mentor = await prisma.user.findUnique({ where: { id: result.data.mentorId } });
  if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });
  if (!mentor.mentorHourlyRate || mentor.mentorHourlyRate <= 0) {
    return res.status(400).json({ message: 'This mentor does not have a session rate configured yet.' });
  }

  const scheduledAt = new Date(result.data.scheduledAt);
  const currency = checkoutCurrency(req);
  const amount = convertGelToStripeMinorUnits(mentor.mentorHourlyRate, currency);

  let stripePayment, booking;
  try {
    ({ stripePayment, booking } = await createMentorshipCheckoutRecordsStripe({
      mentorId: mentor.id,
      studentId: req.user!.id,
      scheduledAt,
      amount,
      amountGel: mentor.mentorHourlyRate,
      currency,
      studentPhone: result.data.studentPhone,
      consultationDescription: result.data.consultationDescription,
    }));
  } catch (err) {
    if (err instanceof SlotUnavailableError) return res.status(400).json({ message: err.message });
    throw err;
  }
  await prisma.mentorBookingHistory.create({
    data: { bookingId: booking.id, action: 'CREATED', performedById: req.user!.id, newScheduledAt: scheduledAt },
  });
  const { successUrl, cancelUrl } = resultRedirects(stripePayment.id);
  const session = await createStripeSessionOrRespond(res, {
    externalOrderId: stripePayment.id,
    amount,
    currency: currency.toLowerCase() as 'usd' | 'eur',
    productName: `Mentorship session with ${mentor.name}`,
    successUrl,
    cancelUrl,
    customerEmail: req.user!.email,
  });
  if (!session) return;
  const updated = await prisma.stripePayment.update({
    where: { id: stripePayment.id },
    data: { stripeSessionId: session.stripeSessionId, checkoutUrl: session.checkoutUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: session.checkoutUrl });
});

// ============================================================
// CHECKOUT — GIG ESCROW FUNDING
// ============================================================
router.post('/checkout/gig/:gigId', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const gig = await prisma.gig.findUnique({ where: { id: req.params.gigId } });
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });
  if (gig.postedById !== req.user!.id) return res.status(403).json({ message: 'Only the gig owner can fund escrow for this gig.' });
  if (gig.status !== 'assigned' || !gig.assignedFreelancerId) {
    return res.status(400).json({ message: 'Gig must be in "assigned" status with a freelancer to fund escrow.' });
  }
  const existingTransaction = await prisma.gigTransaction.findUnique({ where: { gigId: gig.id } });
  if (existingTransaction) return res.status(400).json({ message: 'Escrow has already been funded for this gig.' });
  const application = await prisma.gigApplication.findFirst({
    where: { gigId: gig.id, applicantId: gig.assignedFreelancerId, status: 'accepted' },
  });
  if (!application) return res.status(400).json({ message: 'No accepted application found for this gig.' });
  const reusableEscrow = await findReusablePendingOrder(req.user!.id, 'GIG_ESCROW_FUNDING', gig.id);
  if (reusableEscrow) return res.status(200).json({ paymentId: reusableEscrow.id, redirectUrl: reusableEscrow.checkoutUrl });

  const currency = checkoutCurrency(req);
  const amount = convertGelToStripeMinorUnits(application.bidAmount, currency);
  const stripePayment = await prisma.stripePayment.create({
    data: {
      stripeSessionId: `pending-${crypto.randomUUID()}`,
      userId: req.user!.id,
      purpose: 'GIG_ESCROW_FUNDING',
      paymentModel: paymentModelForPurpose('GIG_ESCROW_FUNDING'),
      referenceId: gig.id,
      amount,
      amountGel: application.bidAmount,
      currency,
      status: 'PENDING',
    },
  });
  const { successUrl, cancelUrl } = resultRedirects(stripePayment.id);
  const session = await createStripeSessionOrRespond(res, {
    externalOrderId: stripePayment.id,
    amount,
    currency: currency.toLowerCase() as 'usd' | 'eur',
    productName: `Escrow funding: ${gig.title}`,
    successUrl,
    cancelUrl,
    customerEmail: req.user!.email,
  });
  if (!session) return;
  const updated = await prisma.stripePayment.update({
    where: { id: stripePayment.id },
    data: { stripeSessionId: session.stripeSessionId, checkoutUrl: session.checkoutUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: session.checkoutUrl });
});

// ============================================================
// CHECKOUT — DIGITAL PRODUCT
// ============================================================
router.post('/checkout/product/:productId', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.productId } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (product.price <= 0) return res.status(400).json({ message: 'This product is free — claim it directly instead of checking out.' });
  const existingPurchase = await prisma.productPurchase.findUnique({
    where: { userId_productId: { userId: req.user!.id, productId: product.id } },
  });
  if (existingPurchase?.paymentStatus === 'COMPLETED') return res.status(400).json({ message: 'You already own this product.' });
  const reusable = await findReusablePendingOrder(req.user!.id, 'PRODUCT', product.id);
  if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.checkoutUrl });

  // Admin/manager/moderator test-mode bypass — same posture as routes/
  // payments.ts's identical BOG-side bypass.
  const requesterAdminRole = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole;
  if (requesterAdminRole) {
    const freePayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `admin-test-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'PRODUCT',
        paymentModel: paymentModelForPurpose('PRODUCT'),
        referenceId: product.id,
        amount: 0,
        amountGel: 0,
        currency: 'USD',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    await completeProductPurchase({ userId: req.user!.id, productId: product.id, amount: 0 });
    return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, purchased: true });
  }

  const currency = checkoutCurrency(req);
  // The actual charged amount when a discount is active — same reasoning as
  // routes/payments.ts's BOG checkout: the platform's commission applies to
  // whatever this converts to, never the original price.
  const productPriceGel = getCurrentProductPrice(product);
  const amount = convertGelToStripeMinorUnits(productPriceGel, currency);
  const stripePayment = await prisma.stripePayment.create({
    data: {
      stripeSessionId: `pending-${crypto.randomUUID()}`,
      userId: req.user!.id,
      purpose: 'PRODUCT',
      paymentModel: paymentModelForPurpose('PRODUCT'),
      referenceId: product.id,
      amount,
      amountGel: productPriceGel,
      currency,
      status: 'PENDING',
    },
  });
  const { successUrl, cancelUrl } = resultRedirects(stripePayment.id);
  const session = await createStripeSessionOrRespond(res, {
    externalOrderId: stripePayment.id,
    amount,
    currency: currency.toLowerCase() as 'usd' | 'eur',
    productName: product.title,
    successUrl,
    cancelUrl,
    customerEmail: req.user!.email,
  });
  if (!session) return;
  const updated = await prisma.stripePayment.update({
    where: { id: stripePayment.id },
    data: { stripeSessionId: session.stripeSessionId, checkoutUrl: session.checkoutUrl },
  });
  res.status(201).json({ paymentId: updated.id, redirectUrl: session.checkoutUrl });
});

// ============================================================
// WEBHOOK — public, no auth. Authenticity comes entirely from Stripe's own
// signature (see stripePaymentService.constructStripeWebhookEvent), verified
// against the raw request body captured by server.ts's express.json({verify})
// hook — the same mechanism the BOG callback handler already relies on.
// ============================================================
router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string' || !req.rawBody) {
    return res.status(400).json({ message: 'Missing Stripe signature.' });
  }
  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(req.rawBody, signature);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err instanceof Error ? err.message : err);
    return res.status(400).json({ message: 'Invalid Stripe signature.' });
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') {
    // Every other event type (payment_intent.*, charge.*, etc.) is either
    // redundant with checkout.session.completed for this integration's
    // "did the Checkout Session finish" model, or not something this app
    // currently acts on — ack and move on rather than erroring.
    return res.status(200).json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const stripePayment = await prisma.stripePayment.findUnique({ where: { stripeSessionId: session.id } });
  if (!stripePayment) {
    // Signature was valid but we don't recognize this session id — this
    // fires for every session created before its row was updated with the
    // real id (a narrow race between session creation and our own DB
    // update above) or for a session from a different environment's keys
    // pointing at this webhook by mistake; ack either way, nothing to do.
    return res.status(200).json({ received: true });
  }
  if (stripePayment.status !== 'PENDING') {
    return res.status(200).json({ received: true }); // already processed — idempotent no-op
  }

  try {
    if (event.type === 'checkout.session.expired') {
      await markStripeCheckoutExpired(stripePayment.id, event);
    } else {
      await applyStripePaymentResult(stripePayment.id, session, event);
    }
  } catch (err) {
    console.error('[stripe-webhook] failed to apply payment result:', err);
    Sentry.captureException(err, { extra: { stripePaymentId: stripePayment.id, sessionId: session.id, eventType: event.type } });
    // 500 so Stripe retries; fulfillment below is idempotent (status guard
    // above + the same per-purpose unique-constraint guards BOG's handler uses).
    return res.status(500).json({ message: 'Failed to process webhook.' });
  }
  res.status(200).json({ received: true });
});

// Shared by the webhook's checkout.session.expired branch and the /status
// poll + paymentReconciliationService's own expired handling — an abandoned
// Stripe Checkout session must not leave a SCHEDULED-but-unpaid
// MentorshipBooking permanently blocking the mentor's slot, regardless of
// which of those three paths is the one that notices the expiry first. Same
// "free the slot back up" fix as the BOG failure path in
// payments.ts's applyBogPaymentResult.
export async function markStripeCheckoutExpired(stripePaymentId: string, rawEvent: unknown) {
  const stripePayment = await prisma.stripePayment.update({
    where: { id: stripePaymentId },
    data: { status: 'FAILED', rawEvent: rawEvent as any },
  });
  if (stripePayment.purpose === 'MENTORSHIP') {
    await prisma.mentorshipBooking.updateMany({
      where: { stripePaymentId: stripePayment.id, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });
  }
}

export async function applyStripePaymentResult(stripePaymentId: string, session: Stripe.Checkout.Session, rawEvent: unknown) {
  const stripePayment = await prisma.stripePayment.update({
    where: { id: stripePaymentId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      rawEvent: rawEvent as any,
    },
  });

  if (stripePayment.purpose === 'COURSE') {
    const { isNewEnrollment, course } = await completeCoursePurchase({
      userId: stripePayment.userId,
      courseId: stripePayment.referenceId,
      // GEL, not stripePayment.amount (USD/EUR cents) — see amountGel's own
      // schema comment. The instructor's earningsBalance is GEL tetri.
      amount: stripePayment.amountGel,
    });
    if (isNewEnrollment && course) await notifyCourseEnrollment(stripePayment.userId, course);
  } else if (stripePayment.purpose === 'GIG_ESCROW_FUNDING') {
    const gig = await prisma.gig.findUnique({ where: { id: stripePayment.referenceId } });
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
      // GEL, not stripePayment.amount (USD/EUR cents) — see amountGel's own
      // schema comment. `currency` below stays what the client was actually
      // charged in, for the audit trail; grossAmount is always GEL tetri,
      // same as the BOG-funded path, since that's what the freelancer's
      // earningsBalance is denominated in.
      grossAmount: stripePayment.amountGel,
      currency: stripePayment.currency,
      providerRef: stripePayment.stripeSessionId,
    });
  } else if (stripePayment.purpose === 'MENTORSHIP') {
    const booking = await prisma.mentorshipBooking.findUnique({
      where: { stripePaymentId: stripePayment.id },
      include: { mentor: { select: { name: true, email: true } }, student: { select: { name: true, email: true } } },
    });
    if (!booking) return;

    try {
      // Places the payment into escrow — does NOT credit the mentor yet.
      // See mentorshipEscrowService.ts's own comment for the full release
      // lifecycle (student confirmation, 24h auto-release, or admin
      // dispute resolution).
      // GEL, not stripePayment.amount (USD/EUR cents) — see amountGel's own
      // schema comment.
      await captureMentorshipEscrow({ bookingId: booking.id, grossAmount: stripePayment.amountGel });
    } catch (err) {
      console.error('[stripe-webhook] Failed to capture mentorship escrow:', err);
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
      const message = err instanceof Error ? err.message : 'Calendar event creation failed.';
      console.error('[stripe-webhook] Google Calendar event creation failed:', message);
      await prisma.mentorshipBooking.update({ where: { id: booking.id }, data: { calendarSyncError: message } });
    }

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
      console.error('[stripe-webhook] Mentorship booking emails failed:', err);
    }
  } else if (stripePayment.purpose === 'PRODUCT') {
    await completeProductPurchase({
      userId: stripePayment.userId,
      productId: stripePayment.referenceId,
      // GEL, not stripePayment.amount (USD/EUR cents) — see amountGel's own
      // schema comment. The creator's earningsBalance is GEL tetri.
      amount: stripePayment.amountGel,
    });
  } else if (stripePayment.purpose === 'LIVE_TRAINING') {
    await completeLiveTrainingPurchase({ userId: stripePayment.userId, liveTrainingId: stripePayment.referenceId });
  } else if (stripePayment.purpose === 'ENGLISH_TUTOR_SUBSCRIPTION') {
    await completeTutorSubscriptionPurchase(stripePayment.userId);
  }
}

// ============================================================
// STATUS POLLING — used by the frontend's post-redirect result page while
// waiting for the async webhook to land.
// ============================================================
router.get('/status/:paymentId', authenticate, async (req: Request, res: Response) => {
  const stripePayment = await prisma.stripePayment.findUnique({ where: { id: req.params.paymentId } });
  if (!stripePayment || stripePayment.userId !== req.user!.id) {
    return res.status(404).json({ message: 'Payment not found.' });
  }

  if (stripePayment.status === 'PENDING' && !stripePayment.stripeSessionId.startsWith('pending-')) {
    try {
      const session = await getStripeCheckoutSession(stripePayment.stripeSessionId);
      if (session.status === 'complete' && session.payment_status === 'paid') {
        await applyStripePaymentResult(stripePayment.id, session, { reconciledFrom: 'status-poll' });
      } else if (session.status === 'expired') {
        await markStripeCheckoutExpired(stripePayment.id, { reconciledFrom: 'status-poll' });
      }
    } catch (err) {
      console.error('[stripe-status] reconciliation fetch failed:', err);
    }
  }

  const fresh = await prisma.stripePayment.findUnique({ where: { id: stripePayment.id } });

  let booking: { scheduledAt: Date; googleMeetLink: string | null; calendarSyncError: string | null } | null = null;
  if (fresh!.purpose === 'MENTORSHIP') {
    booking = await prisma.mentorshipBooking.findUnique({
      where: { stripePaymentId: fresh!.id },
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
