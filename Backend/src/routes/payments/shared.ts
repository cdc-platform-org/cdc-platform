/**
 * Helpers shared by every BOG checkout route: the checkout rate limit,
 * the public https callback URL, result-page redirects, reuse of a still-fresh
 * PENDING order (double-click protection) and createBogOrder error mapping.
 */
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { rateLimit } from '../../middleware/rateLimit';
import {
  createBogOrder,
  BogNotConfiguredError,
  CreateBogOrderParams,
  CreateBogOrderResult,
} from '../../services/payments/bogPaymentService';

export const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

// Applied to the four checkout-initiating routes below (not /bog/callback,
// which is BOG's own webhook and must not be throttled, and not /my or
// /bog/status which are just reads) — same in-memory/IP-keyed limiter as
// the rest of this app (see middleware/rateLimit.ts), sized to stop a
// scripted burst of order creation without getting in the way of a real
// user retrying a failed checkout a few times.
export const checkoutRateLimit = rateLimit({
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
export function resolveHttpsCallbackUrl(): string {
  const raw = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, '');
  const httpsBase = raw.startsWith('https://') ? raw : `https://${raw.replace(/^https?:\/\//, '')}`;
  return `${httpsBase}/api/payments/bog/callback`;
}
export const CALLBACK_URL = resolveHttpsCallbackUrl();

// Optional UI-language hint from the client (courses/[id], store/[id], etc.
// all read Next.js's router.locale and send it here) — sanitized down to
// "ka"/"en" inside bogPaymentService.createBogOrder() before it ever reaches
// BOG's API, so a missing/malformed value here is never a security issue.
export function checkoutLang(req: Request): string | undefined {
  return typeof req.body?.lang === 'string' ? req.body.lang : undefined;
}

export function resultRedirects(paymentId: string) {
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
export const PENDING_ORDER_REUSE_WINDOW_MS = 15 * 60 * 1000;

export class BookCheckoutInProgressError extends Error {}

export async function findReusablePendingOrder(
  userId: string,
  purpose: 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING' | 'PRODUCT' | 'HR_SUPPORT' | 'LIVE_TRAINING' | 'ENGLISH_TUTOR_SUBSCRIPTION' | 'CHILDRENS_BOOK' | 'GIFT_CARD' | 'EDUCATOR_VIP' | 'BUSINESS_AI_AGENT',
  referenceId: string,
  expectedAmount?: number,
  expectedPromoId?: string | null
) {
  const existing = await prisma.bogPayment.findFirst({
    where: { userId, purpose, referenceId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  const learningOrder = purpose === 'COURSE' || purpose === 'LIVE_TRAINING';
  if (existing && existing.redirectUrl && (learningOrder || Date.now() - existing.createdAt.getTime() < PENDING_ORDER_REUSE_WINDOW_MS)) {
    // Never reuse a stale checkout after the payable price changed
    // (for example, when a course goes on sale from 700 GEL to 350 GEL).
    if (
      expectedAmount !== undefined &&
      Math.abs(Number(existing.amount) - expectedAmount) >= 0.005
    ) {
      return null;
    }

    if (expectedPromoId !== undefined && existing.promoCodeId !== expectedPromoId) return null;
    return existing;
  }
  return null;
}

export async function createBogOrderOrRespond(res: Response, params: CreateBogOrderParams): Promise<CreateBogOrderResult | null> {
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
