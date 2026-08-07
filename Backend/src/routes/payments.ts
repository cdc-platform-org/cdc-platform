import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { checkoutMentorshipSchema } from '../schemas/paymentSchemas';
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
import { getCurrentPrice, computeCoursePriceWithPromo } from '../services/coursePricing';
import { assertSlotAvailable, SlotUnavailableError, DEFAULT_SESSION_MINUTES } from '../services/mentorAvailabilityService';
import { createMentorshipCalendarEvent } from '../services/googleCalendarService';
import { isBusinessToolsCategory, canPurchaseBusinessTools } from '../utils/marketplaceCategories';
import { sendMentorshipBookingEmails } from '../services/emailService';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cdc.org.ge';

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

async function findReusablePendingOrder(userId: string, purpose: 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING' | 'PRODUCT', referenceId: string) {
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
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course || !course.published) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
    });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'You are already enrolled in this course.' });
    }
    const reusable = await findReusablePendingOrder(req.user!.id, 'COURSE', course.id);
    if (reusable) {
      return res.status(200).json({ paymentId: reusable.id, redirectUrl: reusable.redirectUrl });
    }

    // Charges whatever the course actually costs right now — if it's on an
    // active sale, that's the discounted price, not originalPrice.
    let chargeAmount = getCurrentPrice(course);

    // Optional promo code — re-validated here rather than trusting whatever
    // discountedAmount the client saw from POST /promos/validate, so a
    // tampered/stale client value can never under-charge. Discount is
    // computed against originalPrice and never stacks with an active course
    // sale — see computeCoursePriceWithPromo. currentUses is only
    // incremented once the BOG order is actually created below (not just
    // because a code was typed in); promoCodeId is recorded on the
    // BogPayment itself now, so an abandoned checkout still "spends" a use
    // but is at least traceable to the specific attempt.
    const rawPromoCode = typeof req.body?.promoCode === 'string' ? req.body.promoCode.trim().toUpperCase() : null;
    let appliedPromo: { id: string } | null = null;
    if (rawPromoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: rawPromoCode } });
      if (!promo) return res.status(400).json({ message: 'Invalid promo code.' });
      if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ message: 'This promo code has expired.' });
      if (promo.maxUses && promo.currentUses >= promo.maxUses) return res.status(400).json({ message: 'This promo code has reached its usage limit.' });
      chargeAmount = computeCoursePriceWithPromo(course, promo);
      appliedPromo = promo;
    }

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'COURSE',
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
    if (appliedPromo) {
      await prisma.promoCode.update({ where: { id: appliedPromo.id }, data: { currentUses: { increment: 1 } } });
    }
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

// ============================================================
// CHECKOUT — MENTORSHIP SESSION
// Creates a MentorshipBooking alongside the BogPayment so the chosen
// slot/phone/description survive the BOG redirect round-trip; the actual
// Google Calendar event is created once applyBogPaymentResult() below
// confirms payment (see services/googleCalendarService.ts).
// ============================================================
router.post(
  '/checkout/mentorship',
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const result = checkoutMentorshipSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const mentor = await prisma.user.findUnique({ where: { id: result.data.mentorId } });
    if (!mentor || mentor.role !== 'Mentor') {
      return res.status(404).json({ message: 'Mentor not found.' });
    }

    const scheduledAt = new Date(result.data.scheduledAt);
    try {
      await assertSlotAvailable(mentor.id, scheduledAt);
    } catch (err) {
      if (err instanceof SlotUnavailableError) return res.status(400).json({ message: err.message });
      throw err;
    }

    // No reusable-pending-order shortcut here (unlike course/product/gig-escrow
    // above) — a prior PENDING order may have been for a different
    // scheduledAt, and reusing it would silently book the wrong time.
    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'MENTORSHIP',
        referenceId: mentor.id,
        amount: result.data.amount,
        currency: result.data.currency,
        status: 'PENDING',
      },
    });
    await prisma.mentorshipBooking.create({
      data: {
        bogPaymentId: bogPayment.id,
        mentorId: mentor.id,
        studentId: req.user!.id,
        scheduledAt,
        studentPhone: result.data.studentPhone,
        consultationDescription: result.data.consultationDescription || null,
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: result.data.amount,
      currency: result.data.currency,
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
// CHECKOUT — DIGITAL PRODUCT
// ============================================================
router.post(
  '/checkout/product/:productId',
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.productId } });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    if (product.price <= 0) {
      return res.status(400).json({ message: 'This product is free — claim it directly instead of checking out.' });
    }
    // The real enforcement boundary for the Business Tools purchase
    // restriction — the frontend's identical check (pages/store/[id].tsx)
    // is UX only and does not stop a direct API call.
    if (isBusinessToolsCategory(product.category)) {
      const requester = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true, isVerified: true } });
      if (!canPurchaseBusinessTools(requester)) {
        return res.status(403).json({ message: 'This tool is available exclusively to verified Business accounts.' });
      }
    }
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

    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'PRODUCT',
        referenceId: product.id,
        amount: product.price,
        currency: 'GEL',
        status: 'PENDING',
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrderOrRespond(res, {
      externalOrderId: bogPayment.id,
      amount: product.price,
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
    await prisma.bogPayment.update({
      where: { id: bogPaymentId },
      data: { status: 'FAILED', rawCallback: rawCallback as any },
    });
    return;
  }

  const bogPayment = await prisma.bogPayment.update({
    where: { id: bogPaymentId },
    data: { status: 'COMPLETED', completedAt: new Date(), rawCallback: rawCallback as any },
  });

  if (bogPayment.purpose === 'COURSE') {
    await prisma.courseEnrollment.upsert({
      where: { userId_courseId: { userId: bogPayment.userId, courseId: bogPayment.referenceId } },
      update: {},
      create: { userId: bogPayment.userId, courseId: bogPayment.referenceId },
    });
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
    await prisma.productPurchase.upsert({
      where: { userId_productId: { userId: bogPayment.userId, productId: bogPayment.referenceId } },
      update: { paymentStatus: 'COMPLETED', amount: bogPayment.amount },
      create: {
        userId: bogPayment.userId,
        productId: bogPayment.referenceId,
        amount: bogPayment.amount,
        paymentStatus: 'COMPLETED',
      },
    });
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
  const payments = await prisma.bogPayment.findMany({
    where: { userId: req.user!.id },
    include: { promoCode: { select: { code: true } } },
    orderBy: { createdAt: 'desc' },
  });

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

  res.json({
    data: payments.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      referenceId: p.referenceId,
      referenceTitle:
        p.purpose === 'COURSE'
          ? courseTitleById.get(p.referenceId) ?? null
          : p.purpose === 'PRODUCT'
          ? productTitleById.get(p.referenceId) ?? null
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
