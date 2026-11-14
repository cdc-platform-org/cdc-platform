/**
 * BOG checkout for marketplace purchases: gig escrow funding, HR assistance
 * and Digital Store products.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { PromoCode } from '@prisma/client';
import { authenticate, requireApproved } from '../../middleware/auth';
import { requestHRSupportSchema } from '../../schemas/hrSupportSchemas';
import { calculateHRSupportFee } from '../../services/payments/hrPricingService';
import { completeProductPurchase } from '../../services/marketplace/productSaleService';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import { getCurrentProductPrice } from '../../services/marketplace/productPricing';
import { applyPromoToCheckout, PromoCodeError, giftCardAmountOf } from '../../services/payments/couponService';
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
    // Only published products can be bought — archived/pending/rejected ones 404.
    if (!product || product.status !== 'APPROVED') return res.status(404).json({ message: 'Product not found.' });
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
    let appliedPromo: PromoCode | null = null;
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
          giftCardAmount: giftCardAmountOf(appliedPromo),
        },
      });
      await completeProductPurchase({ userId: req.user!.id, productId: product.id, amount: giftCardAmountOf(appliedPromo) });
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
        giftCardAmount: giftCardAmountOf(appliedPromo),
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
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

export default router;
