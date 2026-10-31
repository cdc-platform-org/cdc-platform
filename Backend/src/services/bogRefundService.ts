import * as Sentry from '@sentry/node';
import { BogPayment, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BogNotConfiguredError, refundBogOrder } from './bogPaymentService';
import { logAdminAction } from './auditLogService';
import { TUTOR_SUBSCRIPTION_PERIOD_DAYS } from './englishTutorSubscriptionService';

// ============================================================
// Admin refunds for BOG payments — full or partial.
//
// Flow (see refundBogPayment below):
//   1. Lock the payment row, validate, write a BogRefund row (REQUESTED).
//   2. Call BOG's refund API with that row's id as the Idempotency-Key
//      (skipped in "record only" mode — the admin already refunded it in
//      BOG's own dashboard and just needs the platform to reflect it).
//   3. Lock again and commit everything in one transaction: refund row
//      SUCCEEDED, BogPayment.refundedAmount/status, creator clawback, and
//      (optionally) revoking the buyer's access.
//   4. Audit log entry.
//
// Escrow purposes (MENTORSHIP / HR_SUPPORT / GIG_ESCROW_FUNDING) can only be
// refunded in full and only while the money is still held in escrow — once
// it has been released to a mentor/specialist/freelancer, refunding the
// buyer would leave the platform out of pocket, so that has to go through
// the dispute flow instead.
// ============================================================

export class RefundError extends Error {
  constructor(public readonly httpStatus: number, message: string) {
    super(message);
    this.name = 'RefundError';
  }
}

const ESCROW_PURPOSES = new Set(['MENTORSHIP', 'HR_SUPPORT', 'GIG_ESCROW_FUNDING']);
const REFUNDABLE_STATUSES = new Set(['COMPLETED', 'PARTIALLY_REFUNDED']);

export interface RefundBogPaymentParams {
  bogPaymentId: string;
  // Minor units. Omitted = everything not yet refunded.
  amount?: number;
  revokeAccess: boolean;
  recordOnly: boolean;
  reason?: string;
  adminId: string;
}

export interface AccessRevocationResult {
  revoked: boolean;
  // Human-readable summary for the admin UI / audit log.
  note: string;
}

export interface RefundBogPaymentResult {
  refundId: string;
  amount: number;
  refundedAmount: number;
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED';
  access: AccessRevocationResult;
  clawbackAmount: number;
}

type Tx = Prisma.TransactionClient;

async function lockPayment(tx: Tx, id: string): Promise<BogPayment | null> {
  await tx.$queryRaw`SELECT id FROM bog_payments WHERE id = ${id} FOR UPDATE`;
  return tx.bogPayment.findUnique({ where: { id } });
}

async function assertEscrowStillHeld(payment: BogPayment): Promise<void> {
  let held = false;
  if (payment.purpose === 'MENTORSHIP') {
    const booking = await prisma.mentorshipBooking.findUnique({ where: { bogPaymentId: payment.id }, select: { escrowStatus: true } });
    held = booking?.escrowStatus === 'HELD_IN_ESCROW';
  } else if (payment.purpose === 'HR_SUPPORT') {
    const request = await prisma.hRSupportRequest.findUnique({ where: { id: payment.referenceId }, select: { escrowStatus: true } });
    held = request?.escrowStatus === 'HELD_IN_ESCROW';
  } else if (payment.purpose === 'GIG_ESCROW_FUNDING') {
    const transaction = await prisma.gigTransaction.findUnique({ where: { gigId: payment.referenceId }, select: { status: true } });
    held = transaction?.status === 'HELD_IN_ESCROW';
  }
  if (!held) {
    throw new RefundError(409, 'The money for this payment is no longer held in escrow (already released or refunded). Resolve it through the dispute flow instead.');
  }
}

// Takes back the creator's/instructor's net share for the part being
// refunded. Computed on cumulative totals (before/after) so several partial
// refunds never claw back more than the original net share in total.
async function clawbackCreatorShare(tx: Tx, payment: BogPayment, refundedBefore: number, refundedAfter: number): Promise<number> {
  let creatorId: string | null = null;
  let netAmount: number | null = null;
  if (payment.purpose === 'COURSE') {
    const [enrollment, course] = await Promise.all([
      tx.courseEnrollment.findUnique({ where: { userId_courseId: { userId: payment.userId, courseId: payment.referenceId } }, select: { netAmount: true } }),
      tx.course.findUnique({ where: { id: payment.referenceId }, select: { instructorId: true } }),
    ]);
    creatorId = course?.instructorId ?? null;
    netAmount = enrollment?.netAmount ?? null;
  } else if (payment.purpose === 'PRODUCT') {
    const [purchase, product] = await Promise.all([
      tx.productPurchase.findUnique({ where: { userId_productId: { userId: payment.userId, productId: payment.referenceId } }, select: { netAmount: true } }),
      tx.digitalProduct.findUnique({ where: { id: payment.referenceId }, select: { submittedById: true } }),
    ]);
    creatorId = product?.submittedById ?? null;
    netAmount = purchase?.netAmount ?? null;
  }
  if (!creatorId || !netAmount || payment.amount <= 0) return 0;

  const clawback = Math.round((netAmount * refundedAfter) / payment.amount) - Math.round((netAmount * refundedBefore) / payment.amount);
  if (clawback <= 0) return 0;
  // earningsBalance may go negative if the creator already withdrew the
  // money — that is intentional: the debt is then netted against their
  // next earnings instead of silently disappearing.
  const creator = await tx.user.update({ where: { id: creatorId }, data: { earningsBalance: { decrement: clawback } } });
  await tx.walletEntry.create({
    data: { userId: creatorId, type: 'REFUND_CLAWBACK', amount: -clawback, balanceAfter: creator.earningsBalance },
  });
  return clawback;
}

async function revokeAccess(tx: Tx, payment: BogPayment): Promise<AccessRevocationResult> {
  switch (payment.purpose) {
    case 'COURSE': {
      const r = await tx.courseEnrollment.deleteMany({ where: { userId: payment.userId, courseId: payment.referenceId } });
      return { revoked: r.count > 0, note: r.count > 0 ? 'Course enrollment removed.' : 'No course enrollment found to remove.' };
    }
    case 'LIVE_TRAINING': {
      const r = await tx.liveTrainingEnrollment.updateMany({
        where: { userId: payment.userId, liveTrainingId: payment.referenceId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      });
      return { revoked: r.count > 0, note: r.count > 0 ? 'Live training enrollment cancelled.' : 'No active live training enrollment found.' };
    }
    case 'PRODUCT': {
      const r = await tx.productPurchase.updateMany({
        where: { userId: payment.userId, productId: payment.referenceId, paymentStatus: 'COMPLETED' },
        data: { paymentStatus: 'REFUNDED' },
      });
      return { revoked: r.count > 0, note: r.count > 0 ? 'Product purchase marked refunded (download access removed).' : 'No completed product purchase found.' };
    }
    case 'ENGLISH_TUTOR_SUBSCRIPTION': {
      const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { tutorSubscriptionPeriodEnd: true } });
      if (!user?.tutorSubscriptionPeriodEnd) return { revoked: false, note: 'No active tutor subscription found.' };
      const newEnd = new Date(user.tutorSubscriptionPeriodEnd.getTime() - TUTOR_SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      const expired = newEnd.getTime() <= Date.now();
      await tx.user.update({
        where: { id: payment.userId },
        data: expired
          ? { tutorSubscriptionTier: 'FREE', tutorSubscriptionPeriodEnd: null, tutorSubscriptionAutoRenew: false }
          : { tutorSubscriptionPeriodEnd: newEnd },
      });
      return { revoked: true, note: expired ? 'Tutor subscription ended.' : `Tutor subscription shortened by ${TUTOR_SUBSCRIPTION_PERIOD_DAYS} days.` };
    }
    case 'CHILDRENS_BOOK':
      // The book's own lifecycle (generation, PDF, delivery) is owned by the
      // book services; the refund is marked on the payment (status
      // REFUNDED/PARTIALLY_REFUNDED) and in the audit log, and any further
      // action on the book itself is a manual admin decision.
      return { revoked: false, note: 'Payment marked refunded. The book itself was not changed — handle it manually if needed.' };
    case 'MENTORSHIP': {
      const r = await tx.mentorshipBooking.updateMany({
        where: { bogPaymentId: payment.id, escrowStatus: 'HELD_IN_ESCROW' },
        data: { escrowStatus: 'REFUNDED', releasedAt: new Date(), releaseTrigger: 'ADMIN_RESOLVED', status: 'CANCELLED' },
      });
      return { revoked: r.count > 0, note: r.count > 0 ? 'Mentorship booking cancelled, escrow marked refunded.' : 'Escrow was no longer held — check the booking manually.' };
    }
    case 'HR_SUPPORT': {
      const r = await tx.hRSupportRequest.updateMany({
        where: { id: payment.referenceId, escrowStatus: 'HELD_IN_ESCROW' },
        data: { escrowStatus: 'REFUNDED', releasedAt: new Date(), releaseTrigger: 'ADMIN_RESOLVED', status: 'CANCELLED' },
      });
      return { revoked: r.count > 0, note: r.count > 0 ? 'HR support request cancelled, escrow marked refunded.' : 'Escrow was no longer held — check the request manually.' };
    }
    case 'GIG_ESCROW_FUNDING': {
      const r = await tx.gigTransaction.updateMany({ where: { gigId: payment.referenceId, status: 'HELD_IN_ESCROW' }, data: { status: 'REFUNDED' } });
      if (r.count > 0) await tx.gig.update({ where: { id: payment.referenceId }, data: { status: 'cancelled' } });
      return { revoked: r.count > 0, note: r.count > 0 ? 'Gig cancelled, escrow marked refunded.' : 'Escrow was no longer held — check the gig manually.' };
    }
    default:
      return { revoked: false, note: 'No automatic access revocation for this payment type.' };
  }
}

export async function refundBogPayment(params: RefundBogPaymentParams): Promise<RefundBogPaymentResult> {
  // ---- 1. validate + reserve ----
  const { payment, refund, isFullOriginal } = await prisma.$transaction(async (tx) => {
    const payment = await lockPayment(tx, params.bogPaymentId);
    if (!payment) throw new RefundError(404, 'Payment not found.');
    if (!REFUNDABLE_STATUSES.has(payment.status)) {
      throw new RefundError(400, `Only completed payments can be refunded (this one is ${payment.status}).`);
    }
    if (!params.recordOnly && payment.bogOrderId.startsWith('pending-')) {
      throw new RefundError(400, 'This payment never reached BOG (no real order was created).');
    }
    const inFlight = await tx.bogRefund.count({ where: { bogPaymentId: payment.id, status: 'REQUESTED' } });
    if (inFlight > 0) {
      throw new RefundError(409, 'Another refund for this payment is still being processed. Check BOG and try again.');
    }
    const remaining = payment.amount - payment.refundedAmount;
    const amount = params.amount ?? remaining;
    if (!Number.isInteger(amount) || amount <= 0) throw new RefundError(400, 'Refund amount must be a positive amount.');
    if (amount > remaining) {
      throw new RefundError(400, `Refund amount is more than what is left to refund (${(remaining / 100).toFixed(2)} ${payment.currency}).`);
    }
    if (ESCROW_PURPOSES.has(payment.purpose) && amount !== payment.amount) {
      throw new RefundError(400, 'Escrow payments (mentorship, HR support, gig funding) can only be refunded in full.');
    }
    const refund = await tx.bogRefund.create({
      data: {
        bogPaymentId: payment.id,
        amount,
        recordOnly: params.recordOnly,
        reason: params.reason,
        requestedById: params.adminId,
      },
    });
    return { payment, refund, isFullOriginal: payment.refundedAmount === 0 && amount === payment.amount };
  });

  if (ESCROW_PURPOSES.has(payment.purpose)) {
    try {
      await assertEscrowStillHeld(payment);
    } catch (err) {
      await prisma.bogRefund.update({ where: { id: refund.id }, data: { status: 'FAILED', errorMessage: (err as Error).message, completedAt: new Date() } });
      throw err;
    }
  }

  // ---- 2. BOG API call ----
  let bogResult: { actionId?: string; raw: unknown } | null = null;
  if (!params.recordOnly) {
    try {
      bogResult = await refundBogOrder({
        bogOrderId: payment.bogOrderId,
        // Omit on a first, full refund (BOG's "refund everything" form);
        // explicit otherwise.
        amount: isFullOriginal ? undefined : refund.amount,
        idempotencyKey: refund.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'BOG refund request failed.';
      await prisma.bogRefund.update({ where: { id: refund.id }, data: { status: 'FAILED', errorMessage: message.slice(0, 2000), completedAt: new Date() } });
      await logAdminAction({
        action: 'finance.payment.refund.failed',
        targetType: 'BogPayment',
        targetId: payment.id,
        performedById: params.adminId,
        metadata: { refundId: refund.id, amount: refund.amount, error: message.slice(0, 500) },
      });
      if (err instanceof BogNotConfiguredError) throw new RefundError(503, err.message);
      throw new RefundError(502, `BOG did not accept the refund: ${message.slice(0, 300)}`);
    }
  }

  // ---- 3. commit locally ----
  let result: RefundBogPaymentResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      const fresh = await lockPayment(tx, payment.id);
      if (!fresh) throw new Error('Payment disappeared mid-refund.');
      const refundedBefore = fresh.refundedAmount;
      const refundedAfter = Math.min(fresh.amount, refundedBefore + refund.amount);
      const status = refundedAfter >= fresh.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      const clawbackAmount = await clawbackCreatorShare(tx, fresh, refundedBefore, refundedAfter);
      // Escrow refunds are always full, so the escrow is always unwound.
      const shouldRevoke = params.revokeAccess || ESCROW_PURPOSES.has(fresh.purpose);
      const access = shouldRevoke ? await revokeAccess(tx, fresh) : { revoked: false, note: 'Access kept (not requested).' };

      await tx.bogPayment.update({
        where: { id: fresh.id },
        data: { refundedAmount: refundedAfter, refundedAt: new Date(), status },
      });
      await tx.bogRefund.update({
        where: { id: refund.id },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date(),
          accessRevoked: access.revoked,
          bogActionId: bogResult?.actionId ?? null,
          bogResponse: (bogResult?.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      return { refundId: refund.id, amount: refund.amount, refundedAmount: refundedAfter, status, access, clawbackAmount };
    });
  } catch (err) {
    // BOG already accepted the refund (or the admin says it was refunded
    // outside), but our bookkeeping failed. Leave the refund row REQUESTED
    // (which blocks a second refund attempt) and shout about it.
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bog-refund] local commit failed after BOG accepted refund:', err);
    Sentry.captureException(err, { extra: { bogPaymentId: payment.id, refundId: refund.id, stage: 'refund-local-commit' } });
    await prisma.bogRefund
      .update({ where: { id: refund.id }, data: { errorMessage: `BOG accepted; local update failed: ${message}`.slice(0, 2000), bogResponse: (bogResult?.raw ?? undefined) as Prisma.InputJsonValue | undefined } })
      .catch(() => undefined);
    throw new RefundError(500, 'The refund was sent to BOG, but saving it on the platform failed. Do NOT refund again — contact a developer to fix the record.');
  }

  // ---- 4. audit ----
  await logAdminAction({
    action: 'finance.payment.refund',
    targetType: 'BogPayment',
    targetId: payment.id,
    performedById: params.adminId,
    metadata: {
      refundId: result.refundId,
      amount: result.amount,
      currency: payment.currency,
      refundedTotal: result.refundedAmount,
      status: result.status,
      recordOnly: params.recordOnly,
      reason: params.reason,
      purpose: payment.purpose,
      referenceId: payment.referenceId,
      userId: payment.userId,
      accessRevoked: result.access.revoked,
      accessNote: result.access.note,
      clawbackAmount: result.clawbackAmount,
      bogActionId: bogResult?.actionId,
    },
  });

  return result;
}
