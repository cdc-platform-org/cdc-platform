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
} from '../services/bogPaymentService';
import { captureEscrow } from '../services/escrowService';
import { getCurrentPrice } from '../services/coursePricing';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;
const CALLBACK_URL = `${BACKEND_URL}/api/payments/bog/callback`;

function resultRedirects(paymentId: string) {
  return {
    successRedirectUrl: `${FRONTEND_URL}/payments/bog/result?paymentId=${paymentId}`,
    failRedirectUrl: `${FRONTEND_URL}/payments/bog/result?paymentId=${paymentId}&status=fail`,
  };
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

    // Charges whatever the course actually costs right now — if it's on an
    // active sale, that's the discounted price, not originalPrice.
    const chargeAmount = getCurrentPrice(course);
    const bogPayment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${crypto.randomUUID()}`,
        userId: req.user!.id,
        purpose: 'COURSE',
        referenceId: course.id,
        amount: chargeAmount,
        currency: 'GEL',
        status: 'PENDING',
      },
    });
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrder({
      externalOrderId: bogPayment.id,
      amount: chargeAmount,
      currency: 'GEL',
      basketItemName: course.title,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
    });
    const updated = await prisma.bogPayment.update({
      where: { id: bogPayment.id },
      data: { bogOrderId: order.bogOrderId, redirectUrl: order.redirectUrl },
    });
    res.status(201).json({ paymentId: updated.id, redirectUrl: order.redirectUrl });
  }
);

// ============================================================
// CHECKOUT — MENTORSHIP SESSION
// Scope note: there is no session booking/scheduling system in this
// codebase yet. This endpoint is payment infrastructure only — it records
// a completed BogPayment (purpose=MENTORSHIP) that proves the buyer paid a
// given mentor; wiring that up to an actual scheduled session is a separate,
// not-yet-built feature.
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
    const { successRedirectUrl, failRedirectUrl } = resultRedirects(bogPayment.id);
    const order = await createBogOrder({
      externalOrderId: bogPayment.id,
      amount: result.data.amount,
      currency: result.data.currency,
      basketItemName: `Mentorship session with ${mentor.name}`,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
    });
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
    const order = await createBogOrder({
      externalOrderId: bogPayment.id,
      amount: application.bidAmount,
      currency: 'GEL',
      basketItemName: `Escrow funding: ${gig.title}`,
      callbackUrl: CALLBACK_URL,
      successRedirectUrl,
      failRedirectUrl,
    });
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
  // MENTORSHIP: the completed BogPayment record IS the grant — no further
  // side effect (no booking system exists yet, see checkout route above).
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
  res.json({
    data: {
      id: fresh!.id,
      status: fresh!.status,
      purpose: fresh!.purpose,
      referenceId: fresh!.referenceId,
      amount: fresh!.amount,
      currency: fresh!.currency,
    },
  });
});

export default router;
