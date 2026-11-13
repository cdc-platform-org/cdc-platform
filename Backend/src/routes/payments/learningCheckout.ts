/**
 * BOG checkout for courses and live trainings (POST /checkout/course/:courseId,
 * POST /checkout/live-training/:id). Seat/price reservation is done by
 * learningCheckoutService; fulfillment after payment by learningPaymentFulfillment.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { PromoCode } from '@prisma/client';
import { authenticate, requireApproved } from '../../middleware/auth';
import { completeCoursePurchase } from '../../services/courseSaleService';
import { paymentModelForPurpose } from '../../services/paymentModel';
import { getCurrentPrice } from '../../services/coursePricing';
import {
  quotePromoToCheckout,
  PromoCodeError,
  giftCardAmountOf,
} from '../../services/couponService';
import { notifyCourseEnrollment } from '../../services/courseEnrollmentNotification';
import { completeLiveTrainingPurchase, notifyLiveTrainingEnrollment } from '../../services/liveTrainingSaleService';
import { getCurrentLiveTrainingPrice } from '../../services/liveTrainingPricing';
import { reserveLearningCheckout } from '../../services/learningCheckoutService';
import { sendRegistrationStatusWhatsApp, formatWhatsAppDate } from '../../services/whatsappService';
import { resolveNotificationLocale } from '../../utils/notificationLocale';
import {
  checkoutRateLimit,
  CALLBACK_URL,
  checkoutLang,
  resultRedirects,
  findReusablePendingOrder,
  createBogOrderOrRespond,
} from './shared';

const router = Router();

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
    const currentCoursePrice = getCurrentPrice(course);
    // Charges whatever the course actually costs right now — if it's on an
    // active sale, that's the discounted price, not originalPrice.
    let chargeAmount = currentCoursePrice;

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
    // AI-tool, BOG + Stripe) now uses — it also atomically claims the
    // maxUses slot right here (not just because a code was typed in at
    // /validate), so a concurrent checkout can never push a capped code
    // past its usage limit; promoCodeId is recorded on the BogPayment
    // itself, so an abandoned checkout still "spends" a use but is at least
    // traceable to the specific attempt.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: PromoCode | null = null;
    if (rawPromoCode && chargeAmount > 0) {
      try {
        const applied = await quotePromoToCheckout(rawPromoCode, 'COURSE', course.id, chargeAmount);
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
    const reusable = await findReusablePendingOrder(req.user!.id, 'COURSE', course.id, chargeAmount, appliedPromo?.id ?? null);
    if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

    if (chargeAmount <= 0) {
      const freeResult = await reserveLearningCheckout({ userId: req.user!.id, purpose: 'COURSE', referenceId: course.id, gateway: 'BOG', amount: chargeAmount, promo: appliedPromo }, async (tx) => {
        const freePayment = await tx.bogPayment.create({
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
          giftCardAmount: giftCardAmountOf(appliedPromo),
        },
      });
      const { isNewEnrollment } = await completeCoursePurchase({ userId: req.user!.id, courseId: course.id, amount: giftCardAmountOf(appliedPromo) }, tx);
        return { freePayment, isNewEnrollment };
      });
      const { freePayment, isNewEnrollment } = freeResult;
      if (isNewEnrollment) await notifyCourseEnrollment(req.user!.id, course).catch((err) => console.error('[payments] enrollment notification failed:', err));
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
    }

    const bogPayment = await reserveLearningCheckout({ userId: req.user!.id, purpose: 'COURSE', referenceId: course.id, gateway: 'BOG', amount: chargeAmount, promo: appliedPromo }, async (tx) => tx.bogPayment.create({
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
        giftCardAmount: giftCardAmountOf(appliedPromo),
      },
    }));
    // Initial-registration WhatsApp, fired the moment checkout is initiated
    // (not yet confirmed) — the payment-status-update send for this same
    // purchase happens later, in notifyCourseEnrollment, once the BOG
    // callback below actually confirms payment. Fire-and-forget: req.user
    // only carries id/role/email (see middleware/auth.ts), so name/phone
    // need their own lookup, same pattern as liveTrainings.ts's /enroll.
    prisma.user
      .findUnique({ where: { id: req.user!.id }, select: { name: true, phone: true } })
      .then((buyer) => {
        if (!buyer?.phone) return;
        sendRegistrationStatusWhatsApp({
          phone: buyer.phone,
          firstName: buyer.name,
          itemTitle: course.title,
          scheduleText: 'ხელმისაწვდომია ახლავე / Available now',
          paymentStatus: 'PENDING',
          locale: resolveNotificationLocale(checkoutLang(req)),
        }).catch((err) => console.error('[payments] sendRegistrationStatusWhatsApp (course PENDING) failed:', err));
      })
      .catch((err) => console.error('[payments] course PENDING WhatsApp user lookup failed:', err));
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
// go through this checkout instead. Server-validated promo codes are supported;
// there is no instructor payout (see
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
      include: { _count: { select: { leads: true, enrollments: { where: { status: { not: 'CANCELLED' } } } } } },
    });
    if (!training) return res.status(404).json({ message: 'Live training not found.' });
    if (!training.price || training.price <= 0) {
      return res.status(400).json({ message: 'This training is free — enroll directly instead of checking out.' });
    }

    const existingEnrollment = await prisma.liveTrainingEnrollment.findUnique({
      where: { userId_liveTrainingId: { userId: req.user!.id, liveTrainingId: training.id } },
    });
    if (existingEnrollment && existingEnrollment.status !== 'CANCELLED') {
      return res.status(400).json({ message: 'You are already enrolled in this training.' });
    }
    if (training._count.leads + training._count.enrollments >= training.maxCapacity) {
      return res.status(409).json({ message: 'This training is fully booked.' });
    }

    let chargeAmount = getCurrentLiveTrainingPrice(training) ?? 0;

    // Same re-validated-server-side promo handling as CHECKOUT — COURSE —
    // see couponService.ts's applyPromoToCheckout.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode : null;
    let appliedPromo: PromoCode | null = null;
    if (rawPromoCode && chargeAmount > 0) {
      try {
        const applied = await quotePromoToCheckout(rawPromoCode, 'LIVE_TRAINING', training.id, chargeAmount);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    const reusable = await findReusablePendingOrder(req.user!.id, 'LIVE_TRAINING', training.id, chargeAmount, appliedPromo?.id ?? null);
    if (reusable) return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });

    if (chargeAmount <= 0) {
      const freeResult = await reserveLearningCheckout({ userId: req.user!.id, purpose: 'LIVE_TRAINING', referenceId: training.id, gateway: 'BOG', amount: chargeAmount, promo: appliedPromo }, async (tx) => {
        const freePayment = await tx.bogPayment.create({
        data: {
          bogOrderId: `free-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'LIVE_TRAINING',
          paymentModel: paymentModelForPurpose('LIVE_TRAINING'),
          referenceId: training.id,
          amount: 0,
          currency: 'GEL',
          status: 'COMPLETED',
          completedAt: new Date(),
          promoCodeId: appliedPromo?.id ?? null,
          giftCardAmount: giftCardAmountOf(appliedPromo),
        },
      });
      const fulfillment = await completeLiveTrainingPurchase({ userId: req.user!.id, liveTrainingId: training.id }, tx);
        return { freePayment, fulfillment };
      });
      const { freePayment, fulfillment } = freeResult;
      if (fulfillment.isNewEnrollment && fulfillment.liveTraining) notifyLiveTrainingEnrollment(req.user!.id, fulfillment.liveTraining);
      return res.status(201).json({ paymentId: freePayment.id, redirectUrl: null, enrolled: true });
    }

    const bogPayment = await reserveLearningCheckout({ userId: req.user!.id, purpose: 'LIVE_TRAINING', referenceId: training.id, gateway: 'BOG', amount: chargeAmount, promo: appliedPromo }, async (tx) => tx.bogPayment.create({
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
        giftCardAmount: giftCardAmountOf(appliedPromo),
      },
    }));
    // Same initial-registration WhatsApp as the COURSE checkout above — see
    // its own comment. The payment-status-update send for this purchase
    // happens later in liveTrainingSaleService.completeLiveTrainingPurchase
    // once the BOG callback below actually confirms payment.
    prisma.user
      .findUnique({ where: { id: req.user!.id }, select: { name: true, phone: true } })
      .then((buyer) => {
        if (!buyer?.phone) return;
        sendRegistrationStatusWhatsApp({
          phone: buyer.phone,
          firstName: buyer.name,
          itemTitle: training.title,
          scheduleText: formatWhatsAppDate(training.startDate ?? training.scheduledAt, resolveNotificationLocale(checkoutLang(req))),
          paymentStatus: 'PENDING',
          locale: resolveNotificationLocale(checkoutLang(req)),
        }).catch((err) => console.error('[payments] sendRegistrationStatusWhatsApp (live training PENDING) failed:', err));
      })
      .catch((err) => console.error('[payments] live training PENDING WhatsApp user lookup failed:', err));
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
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

export default router;
