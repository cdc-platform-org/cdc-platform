/**
 * BOG checkout for a personalised children's book (plus optional audio /
 * animation add-ons).
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { PromoCode } from '@prisma/client';
import { authenticate, requireApproved } from '../../middleware/auth';
import { paymentModelForPurpose } from '../../services/payments/paymentModel';
import {
  quotePromoToCheckout,
  claimPromoRedemption,
  PromoCodeError,
  giftCardAmountOf,
} from '../../services/payments/couponService';
import {
  completeChildrensBookPurchase,
  assertBookReadyForCheckout,
  BookNotFoundError,
  BookNotEligibleForCheckoutError,
  BookPreviewNotConfirmedError,
} from '../../services/childrensBook/bookPurchaseFulfillment';
import { isBookDevPaymentSimulationEnabled, resolveBookPayableAmountTetri } from '../../services/childrensBook/bookMockConfig';
import { calculateBookPrice } from '../../services/childrensBook/bookStateService';
import { calculateAudioPrice, calculateTotalBookPrice } from '../../services/childrensBook/bookNarrationService';
import {
  checkoutRateLimit,
  CALLBACK_URL,
  checkoutLang,
  resultRedirects,
  BookCheckoutInProgressError,
  findReusablePendingOrder,
  createBogOrderOrRespond,
} from './shared';

const router = Router();

// ============================================================
// CHECKOUT — CHILDREN'S BOOK — same DIRECT/single-purchase shape as
// CHECKOUT — DIGITAL PRODUCT above, except the eligibility check is the
// book's own state machine (bookStateService.canInitiatePayment) rather
// than a ProductPurchase row, and the atomic CHARACTER_APPROVED ->
// PAYMENT_PENDING claim happens here (not in fulfillment) since this is
// the one place that transition is legal to make.
// ============================================================
router.post(
  '/checkout/childrens-book/:bookId',
  checkoutRateLimit,
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    // Fail closed, not just a hidden frontend button: a real BOG order was
    // accidentally created during QA because the UI showed both the real
    // and dev-simulated payment actions together. isBookDevPaymentSimulationEnabled()
    // is already hard-false in production regardless of env vars (see
    // bookMockConfig.ts), so this guard is a true no-op in production —
    // only a local/dev process that has deliberately opted into payment
    // simulation ever hits this 403.
    if (isBookDevPaymentSimulationEnabled()) {
      return res.status(403).json({ message: 'Real checkout is disabled while dev payment simulation is enabled on this server.' });
    }
    let book: { id: string; pageCount: number; audioAddOnPurchased: boolean; animationAddOnPurchased: boolean };
    try {
      book = await assertBookReadyForCheckout(req.params.bookId, req.user!.id);
    } catch (err) {
      if (err instanceof BookNotFoundError) return res.status(404).json({ message: err.message });
      if (err instanceof BookNotEligibleForCheckoutError) return res.status(400).json({ message: err.message });
      if (err instanceof BookPreviewNotConfirmedError) return res.status(400).json({ message: err.message, code: 'PREVIEW_NOT_CONFIRMED' });
      throw err;
    }

    // listPriceGel is derived fresh from pageCount (1 GEL/page), never read
    // off the stored BookProject.priceGel column directly — the DB CHECK
    // constraint already guarantees they agree, but re-deriving here is the
    // stricter "never trust a stored/frontend price for an actual charge"
    // layer the product requires. payableAmountGel is what's actually
    // charged — identical to listPriceGel for every book except one
    // operator-named QA book during a controlled local discount test (see
    // resolveBookPayableAmountTetri's own comment). Both names kept
    // distinct through this whole function, deliberately never collapsed
    // into one "amount" variable.
    const listPriceGel = calculateBookPrice(book.pageCount);
    const audioPriceGel = calculateAudioPrice(book.audioAddOnPurchased);
    const totalPriceGel = calculateTotalBookPrice(listPriceGel, book.audioAddOnPurchased, book.animationAddOnPurchased);
    const payableAmountGel = resolveBookPayableAmountTetri(book.id, totalPriceGel);

    // Optional promo code — same re-validated-server-side rule as every
    // other checkout (see couponService.ts). Quoted here, but its usage slot
    // is only claimed inside the transaction below, together with the
    // book's CHARACTER_APPROVED -> PAYMENT_PENDING move, so a failed claim
    // never leaves the book stuck in PAYMENT_PENDING and a lost status race
    // never spends a use.
    const rawPromoCode = typeof req.body?.promoCode === 'string' && req.body.promoCode.trim() ? req.body.promoCode : null;
    let chargeAmount = payableAmountGel;
    let appliedPromo: PromoCode | null = null;
    if (rawPromoCode) {
      try {
        const applied = await quotePromoToCheckout(rawPromoCode, 'CHILDRENS_BOOK', book.id, payableAmountGel);
        chargeAmount = applied.chargeAmount;
        appliedPromo = applied.appliedPromo;
      } catch (err) {
        if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
        throw err;
      }
    }

    const reusable = await findReusablePendingOrder(req.user!.id, 'CHILDRENS_BOOK', book.id, chargeAmount, appliedPromo?.id ?? null);
    if (reusable) {
      return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });
    }

    // Atomic claim: only a book genuinely still in CHARACTER_APPROVED moves
    // to PAYMENT_PENDING. A concurrent duplicate click loses this race and
    // falls through to find the winner's reusable PENDING order instead on
    // its own retry — never two BogPayment rows for one checkout attempt.
    // A 100% promo (chargeAmount 0) skips BOG entirely: the payment row is
    // recorded already COMPLETED and the book is fulfilled right away, the
    // same shape as the product/course free-via-promo paths.
    const isFree = chargeAmount <= 0;
    let bogPayment: Awaited<ReturnType<typeof prisma.bogPayment.create>>;
    try {
      bogPayment = await prisma.$transaction(async (tx) => {
        const claimed = await tx.bookProject.updateMany({
          where: { id: book.id, status: 'CHARACTER_APPROVED' },
          data: { status: 'PAYMENT_PENDING', audioPriceGel, totalPriceGel },
        });
        if (claimed.count !== 1) throw new BookCheckoutInProgressError();
        if (appliedPromo) await claimPromoRedemption(appliedPromo, tx);
        return tx.bogPayment.create({
          data: {
            bogOrderId: isFree ? `promo-${crypto.randomUUID()}` : `pending-${crypto.randomUUID()}`,
            userId: req.user!.id,
            purpose: 'CHILDRENS_BOOK',
            paymentModel: paymentModelForPurpose('CHILDRENS_BOOK'),
            referenceId: book.id,
            amount: isFree ? 0 : chargeAmount,
            currency: 'GEL',
            status: isFree ? 'COMPLETED' : 'PENDING',
            completedAt: isFree ? new Date() : null,
            promoCodeId: appliedPromo?.id ?? null,
            giftCardAmount: giftCardAmountOf(appliedPromo),
          },
        });
      });
    } catch (err) {
      if (err instanceof BookCheckoutInProgressError) return res.status(409).json({ message: 'This book already has a checkout in progress.' });
      if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
      throw err;
    }

    if (isFree) {
      await completeChildrensBookPurchase({ bookProjectId: book.id });
      return res.status(201).json({ paymentId: bogPayment.id, redirectUrl: null, purchased: true });
    }

    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: payableAmountGel === totalPriceGel ? "Custom AI Children's Book" : "Custom AI Children's Book (QA test — discounted)",
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
