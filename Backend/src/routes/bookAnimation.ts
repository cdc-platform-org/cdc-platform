import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PromoCode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { JWT_SECRET } from '../utils/env';
import { createBogOrder, BogNotConfiguredError } from '../services/bogPaymentService';
import { paymentModelForPurpose } from '../services/paymentModel';
import { quotePromoToCheckout, claimPromoRedemption, PromoCodeError, giftCardAmountOf } from '../services/couponService';
import { isBookAiMocked, isBookDevPaymentSimulationEnabled } from '../services/bookMockConfig';
import { readSoraConfig } from '../services/bookAnimationSora';
import { findBookByShareToken } from '../services/bookExtrasService';
import { getBookAssetUrl, isUsingCloudBookStorage, readBookAsset } from '../services/bookStorageService';
import { attachmentHeader } from '../services/bookAudioBundle';
import { ANIMATION_PRICE_TETRI, ANIMATION_PROMO_TARGET_ID } from '../services/bookAnimationPlan';
import { completeBookAnimationPurchase, isBookAnimatable, queueFreeAnimation } from '../services/bookAnimationService';

// ============================================================
// Children's Book — "animated video" add-on routes (mounted on
// /api/childrens-books next to routes/childrensBook.ts). Kept in their own
// file so the book wizard routes stay untouched.
//
//   POST /:id/animation                 owner: start checkout (BOG redirect URL,
//                                       or done at once for a 100% promo)
//   GET  /:id/animation                 owner/admin: status + video URLs
//   POST /:id/animation/retry           owner: free re-render of a paid FAILED video
//   POST /:id/animation/simulate-payment  dev only (never in production)
//   POST /:id/animation/admin-render    admin: free render/re-render for testing
//   GET  /shared/:token/animation       public share page: video URL when READY
//   GET  /animation-video/:animationId  signed (exp+sig) stream / download
// ============================================================

const router = Router();

const checkoutRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, message: 'Too many checkout attempts. Please wait a moment and try again.' });

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';
const PENDING_ORDER_REUSE_WINDOW_MS = 30 * 60 * 1000;
const VIDEO_LINK_TTL_SECONDS = 2 * 60 * 60;

function callbackUrl(): string {
  const raw = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  const httpsBase = raw.startsWith('https://') ? raw : `https://${raw.replace(/^https?:\/\//, '')}`;
  return `${httpsBase}/api/payments/bog/callback`;
}

function backendBaseUrl(req: Request): string {
  const configured = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  return configured || `${req.protocol}://${req.get('host')}`;
}

// ---- signed video links -------------------------------------------------------
// <video src> can't send the Authorization header, so the player gets a
// short-lived HMAC-signed link instead (in cloud mode playback uses the
// blob's own SAS URL; this route is then only used for the download).
function signVideo(animationId: string, exp: number): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(`book-animation:${animationId}:${exp}`).digest('base64url');
}

export function verifyVideoSignature(animationId: string, exp: number, sig: string, now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(signVideo(animationId, exp));
  const given = Buffer.from(sig || '');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function signedVideoLink(req: Request, animationId: string, download: boolean): string {
  const exp = Math.floor(Date.now() / 1000) + VIDEO_LINK_TTL_SECONDS;
  return `${backendBaseUrl(req)}/api/childrens-books/animation-video/${animationId}?exp=${exp}&sig=${signVideo(animationId, exp)}${download ? '&download=1' : ''}`;
}

async function videoUrls(req: Request, animation: { id: string; videoKey: string | null }) {
  if (!animation.videoKey) return { videoUrl: null, downloadUrl: null };
  const cloud = isUsingCloudBookStorage() ? await getBookAssetUrl(animation.videoKey, 120).catch(() => null) : null;
  return { videoUrl: cloud ?? signedVideoLink(req, animation.id, false), downloadUrl: signedVideoLink(req, animation.id, true) };
}

// ---- helpers ---------------------------------------------------------------------

async function bookFor(req: Request, res: Response, opts: { allowAdmin?: boolean } = {}) {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, status: true, title: true } });
  if (!book) {
    res.status(404).json({ message: 'Book not found.' });
    return null;
  }
  if (book.userId !== req.user!.id) {
    const isAdmin = opts.allowAdmin ? !!(await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } }))?.adminRole : false;
    if (!isAdmin) {
      res.status(404).json({ message: 'Book not found.' });
      return null;
    }
  }
  return book;
}

async function statusPayload(req: Request, bookId: string, bookStatus: string) {
  const animation = await prisma.bookAnimation.findUnique({ where: { bookProjectId: bookId } });
  const urls = animation?.status === 'READY' ? await videoUrls(req, animation) : { videoUrl: null, downloadUrl: null };
  return {
    priceTetri: ANIMATION_PRICE_TETRI,
    promoTargetType: 'AI_TOOL' as const,
    promoTargetId: ANIMATION_PROMO_TARGET_ID,
    eligible: isBookAnimatable(bookStatus),
    devPaymentSimulation: isBookDevPaymentSimulationEnabled(),
    // AI (Sora) motion is only promised when it is actually configured.
    soraEnabled: !isBookAiMocked() && !!readSoraConfig(),
    animation: animation
      ? {
          id: animation.id,
          status: animation.status,
          paid: !!animation.paidAt,
          durationSec: animation.durationSec,
          // Only a short, generic reason is exposed to the buyer.
          failed: animation.status === 'FAILED',
          updatedAt: animation.updatedAt,
          ...urls,
        }
      : null,
  };
}

// ---- owner routes -----------------------------------------------------------------

router.get('/:id/animation', authenticate, async (req: Request, res: Response) => {
  const book = await bookFor(req, res, { allowAdmin: true });
  if (!book) return;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ data: await statusPayload(req, book.id, book.status) });
});

router.post('/:id/animation', checkoutRateLimit, authenticate, requireApproved, async (req: Request, res: Response) => {
  const book = await bookFor(req, res);
  if (!book) return;
  if (!isBookAnimatable(book.status)) return res.status(400).json({ message: 'The book must be finished before it can be animated.' });

  const existing = await prisma.bookAnimation.findUnique({ where: { bookProjectId: book.id } });
  if (existing && existing.status !== 'PAYMENT_PENDING') {
    if (existing.status === 'FAILED' && existing.paidAt) {
      await queueFreeAnimation({ bookProjectId: book.id, userId: req.user!.id, paidVia: existing.paidVia ?? 'BOG' });
      return res.status(200).json({ purchased: true, redirectUrl: null });
    }
    return res.status(409).json({ message: 'This book already has an animation.' });
  }

  const rawPromoCode = typeof req.body?.promoCode === 'string' && req.body.promoCode.trim() ? req.body.promoCode : null;
  let chargeAmount = ANIMATION_PRICE_TETRI;
  let appliedPromo: PromoCode | null = null;
  if (rawPromoCode) {
    try {
      const applied = await quotePromoToCheckout(rawPromoCode, 'AI_TOOL', ANIMATION_PROMO_TARGET_ID, ANIMATION_PRICE_TETRI);
      chargeAmount = applied.chargeAmount;
      appliedPromo = applied.appliedPromo;
    } catch (err) {
      if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
      throw err;
    }
  }

  // Dev payment simulation: the client calls /simulate-payment instead.
  if (isBookDevPaymentSimulationEnabled() && chargeAmount > 0) {
    await prisma.bookAnimation.upsert({ where: { bookProjectId: book.id }, update: {}, create: { bookProjectId: book.id, userId: req.user!.id } });
    return res.status(200).json({ redirectUrl: null, purchased: false, simulate: true });
  }

  // Reuse a fresh PENDING order for the same price/promo (double clicks).
  const reusable = await prisma.bogPayment.findFirst({ where: { userId: req.user!.id, purpose: 'BOOK_ANIMATION', referenceId: book.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  if (reusable?.redirectUrl && Date.now() - reusable.createdAt.getTime() < PENDING_ORDER_REUSE_WINDOW_MS && reusable.amount === chargeAmount && (reusable.promoCodeId ?? null) === (appliedPromo?.id ?? null)) {
    return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });
  }

  const isFree = chargeAmount <= 0;
  let bogPayment;
  try {
    bogPayment = await prisma.$transaction(async (tx) => {
      await tx.bookAnimation.upsert({ where: { bookProjectId: book.id }, update: {}, create: { bookProjectId: book.id, userId: req.user!.id } });
      if (appliedPromo) await claimPromoRedemption(appliedPromo, tx);
      return tx.bogPayment.create({
        data: {
          bogOrderId: isFree ? `promo-${crypto.randomUUID()}` : `pending-${crypto.randomUUID()}`,
          userId: req.user!.id,
          purpose: 'BOOK_ANIMATION',
          paymentModel: paymentModelForPurpose('BOOK_ANIMATION'),
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
    if (err instanceof PromoCodeError) return res.status(400).json({ message: err.message });
    throw err;
  }

  if (isFree) {
    await completeBookAnimationPurchase({ bookProjectId: book.id, paidVia: 'PROMO' });
    return res.status(201).json({ paymentId: bogPayment.id, redirectUrl: null, purchased: true });
  }

  try {
    const order = await createBogOrder({
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: "Children's book animated video",
      callbackUrl: callbackUrl(),
      successRedirectUrl: `${FRONTEND_URL}/payments/bog/result?paymentId=${bogPayment.id}`,
      failRedirectUrl: `${FRONTEND_URL}/payments/bog/result?paymentId=${bogPayment.id}&status=fail`,
      lang: typeof req.body?.lang === 'string' ? req.body.lang : undefined,
    });
    await prisma.bogPayment.update({ where: { id: bogPayment.id }, data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl } });
    return res.status(201).json({ paymentId: bogPayment.id, redirectUrl: order.redirectUrl });
  } catch (err) {
    console.error('[book-animation] createBogOrder failed:', err instanceof Error ? err.message : err);
    if (err instanceof BogNotConfiguredError) return res.status(501).json({ message: err.message });
    return res.status(502).json({ message: 'The payment provider is not reachable right now. Please try again.' });
  }
});

router.post('/:id/animation/simulate-payment', authenticate, async (req: Request, res: Response) => {
  if (!isBookDevPaymentSimulationEnabled()) return res.status(403).json({ message: 'Not available.' });
  const book = await bookFor(req, res);
  if (!book) return;
  const { handled } = await completeBookAnimationPurchase({ bookProjectId: book.id, paidVia: 'DEV_SIMULATION' });
  if (!handled) return res.status(409).json({ message: 'No animation is waiting for payment.' });
  res.json({ data: await statusPayload(req, book.id, book.status) });
});

router.post('/:id/animation/retry', authenticate, async (req: Request, res: Response) => {
  const book = await bookFor(req, res);
  if (!book) return;
  const existing = await prisma.bookAnimation.findUnique({ where: { bookProjectId: book.id } });
  if (!existing || existing.status !== 'FAILED' || !existing.paidAt) return res.status(409).json({ message: 'Nothing to retry.' });
  await queueFreeAnimation({ bookProjectId: book.id, userId: book.userId, paidVia: existing.paidVia ?? 'BOG' });
  res.json({ data: await statusPayload(req, book.id, book.status) });
});

// Admin testing: render (or re-render with {force:true}) any finished book for free.
router.post('/:id/animation/admin-render', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const book = await prisma.bookProject.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, status: true } });
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  if (!isBookAnimatable(book.status)) return res.status(400).json({ message: 'The book must be finished before it can be animated.' });
  const existing = await prisma.bookAnimation.findUnique({ where: { bookProjectId: book.id } });
  if (existing?.status === 'PAYMENT_PENDING') {
    await completeBookAnimationPurchase({ bookProjectId: book.id, paidVia: 'ADMIN' });
  } else {
    await queueFreeAnimation({ bookProjectId: book.id, userId: book.userId, paidVia: 'ADMIN', force: req.body?.force === true });
  }
  res.json({ data: await statusPayload(req, book.id, book.status) });
});

// ---- public share page --------------------------------------------------------------

router.get('/shared/:token/animation', async (req: Request, res: Response) => {
  const book = await findBookByShareToken(req.params.token);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  if (!book) return res.status(404).json({ message: 'Book not found.' });
  const animation = await prisma.bookAnimation.findUnique({ where: { bookProjectId: book.id } });
  if (!animation || animation.status !== 'READY') return res.json({ data: null });
  res.json({ data: { durationSec: animation.durationSec, ...(await videoUrls(req, animation)) } });
});

// ---- signed video stream ----------------------------------------------------------

router.get('/animation-video/:animationId', async (req: Request, res: Response) => {
  const exp = Number(req.query.exp);
  if (!verifyVideoSignature(req.params.animationId, exp, String(req.query.sig ?? ''))) return res.status(403).json({ message: 'This video link has expired.' });
  const animation = await prisma.bookAnimation.findUnique({ where: { id: req.params.animationId }, include: { bookProject: { select: { title: true } } } });
  if (!animation?.videoKey || animation.status !== 'READY') return res.status(404).json({ message: 'Video not found.' });
  const download = req.query.download === '1';

  if (isUsingCloudBookStorage() && !download) {
    const url = await getBookAssetUrl(animation.videoKey, 120);
    if (url) return res.redirect(302, url);
  }

  let video: Buffer;
  try {
    video = await readBookAsset(animation.videoKey);
  } catch {
    return res.status(404).json({ message: 'Video not available.' });
  }
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=600');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (download) res.setHeader('Content-Disposition', attachmentHeader(animation.bookProject.title, 'mp4'));

  // Range support so the player can seek.
  const range = typeof req.headers.range === 'string' ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range) : null;
  if (range && !download) {
    const size = video.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2] || 0);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    return res.end(video.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', String(video.length));
  return res.end(video);
});

export default router;
