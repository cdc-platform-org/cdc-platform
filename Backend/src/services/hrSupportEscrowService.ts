import { prisma } from '../lib/prisma';

// ============================================================
// HR Assistance payout — same held-escrow model as mentorship sessions
// (mentorshipEscrowService.ts): funds sit in escrow from the moment payment
// completes until the employer confirms the delivered report, or an N-day
// grace period passes with no dispute after the specialist marks the
// request DELIVERED, whichever comes first. An employer-raised dispute
// freezes the auto-release clock and hands the request to an admin.
//
// Split defaults to the platform's proposed 60% specialist / 40% platform
// (a materially bigger platform share than the 20% marketplace/mentorship
// commission — justified here by this being a higher-touch, time-intensive
// human service rather than a passive digital sale/session).
// ============================================================

const PLATFORM_COMMISSION_RATE = 0.4;

// How long after the specialist marks a request DELIVERED a HELD_IN_ESCROW
// request with no dispute auto-releases to them. Longer than mentorship's
// 24h grace — the employer is reviewing a substantial written report, not
// just confirming a session happened.
const AUTO_RELEASE_GRACE_MS = 5 * 24 * 60 * 60 * 1000;

export class HRSupportEscrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HRSupportEscrowError';
  }
}

// Called once, right after the request's payment is confirmed complete —
// see routes/payments.ts's HR_SUPPORT branch. Computes and LOCKS IN the
// commission split (never re-derived later), and places the request into
// escrow. Idempotent: a webhook retry against a request that already has
// commissionAmount set is a no-op.
export async function captureHRSupportEscrow(params: { requestId: string; grossAmount: number }): Promise<void> {
  const request = await prisma.hRSupportRequest.findUnique({
    where: { id: params.requestId },
    select: { commissionAmount: true },
  });
  if (!request) return;
  if (request.commissionAmount != null) return; // already captured — no-op

  const commissionAmount = Math.round(params.grossAmount * PLATFORM_COMMISSION_RATE);
  const netAmount = params.grossAmount - commissionAmount;

  await prisma.hRSupportRequest.update({
    where: { id: params.requestId },
    data: {
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmount,
      netAmount,
      escrowStatus: 'HELD_IN_ESCROW',
      paidAt: new Date(),
      status: 'AWAITING_ASSIGNMENT',
    },
  });
}

// Called by the assigned specialist once the Top-3 report is ready — starts
// the auto-release clock. A request can only be delivered once assigned.
export async function markHRSupportDelivered(requestId: string, reportSummary: string): Promise<void> {
  const request = await prisma.hRSupportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HRSupportEscrowError('Request not found.');
  if (!request.assignedSpecialistId) {
    throw new HRSupportEscrowError('This request has no assigned specialist yet.');
  }
  if (request.status === 'DELIVERED') {
    throw new HRSupportEscrowError('This request has already been marked as delivered.');
  }
  await prisma.hRSupportRequest.update({
    where: { id: requestId },
    data: {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      reportSummary,
      autoReleaseAt: new Date(Date.now() + AUTO_RELEASE_GRACE_MS),
    },
  });
}

// Actually credits the specialist's net share — called by the employer's
// explicit confirmation, the auto-release sweep, or an admin resolving a
// dispute in the specialist's favor. Atomic claim (same updateMany-then-
// check-count pattern as mentorshipEscrowService) so two triggers racing
// for the same request can't both pass and double-credit.
export async function releaseHRSupportEscrow(
  requestId: string,
  trigger: 'CLIENT_CONFIRMED' | 'AUTO_RELEASE' | 'ADMIN_RESOLVED'
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.hRSupportRequest.updateMany({
      where: { id: requestId, escrowStatus: 'HELD_IN_ESCROW' },
      data: { escrowStatus: 'RELEASED', releasedAt: new Date(), releaseTrigger: trigger },
    });
    if (claim.count === 0) {
      throw new HRSupportEscrowError('This request has no funds currently held in escrow.');
    }

    const request = await tx.hRSupportRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (!request.assignedSpecialistId) {
      throw new HRSupportEscrowError('This request has no assigned specialist to credit.');
    }
    const specialist = await tx.user.update({
      where: { id: request.assignedSpecialistId },
      data: { earningsBalance: { increment: request.netAmount! } },
    });
    await tx.walletEntry.create({
      data: {
        userId: specialist.id,
        type: 'HR_SUPPORT_CREDIT',
        amount: request.netAmount!,
        relatedHRSupportRequestId: requestId,
        balanceAfter: specialist.earningsBalance,
      },
    });
  });
}

// Admin-only path (via resolveHRSupportDispute below) — locks the escrow as
// refunded without crediting anyone. The actual bank refund to the employer
// still happens by hand through BOG's own dashboard, same posture as every
// other refund path on this platform.
async function refundHRSupportEscrow(requestId: string): Promise<void> {
  const claim = await prisma.hRSupportRequest.updateMany({
    where: { id: requestId, escrowStatus: 'HELD_IN_ESCROW' },
    data: { escrowStatus: 'REFUNDED', releasedAt: new Date(), releaseTrigger: 'ADMIN_RESOLVED' },
  });
  if (claim.count === 0) {
    throw new HRSupportEscrowError('This request has no funds currently held in escrow.');
  }
}

// Freezes the auto-release clock on a request whose funds are still held —
// the employer's own dispute action (routes/hrSupport.ts POST /:id/dispute).
export async function flagHRSupportEscrowForReview(requestId: string, reason: string): Promise<void> {
  const request = await prisma.hRSupportRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HRSupportEscrowError('Request not found.');
  if (request.escrowStatus !== 'HELD_IN_ESCROW') {
    throw new HRSupportEscrowError('This request has no funds currently held in escrow to flag.');
  }
  if (request.disputeRaisedAt) return; // already flagged — no-op, don't overwrite the original reason
  await prisma.hRSupportRequest.update({
    where: { id: requestId },
    data: { disputeRaisedAt: new Date(), disputeReason: reason },
  });
}

// Admin action — resolves a flagged request either way: RELEASE credits the
// specialist as if the employer had confirmed, REFUND locks the funds
// without crediting anyone.
export async function resolveHRSupportDispute(requestId: string, resolution: 'RELEASE' | 'REFUND'): Promise<void> {
  if (resolution === 'RELEASE') {
    await releaseHRSupportEscrow(requestId, 'ADMIN_RESOLVED');
  } else {
    await refundHRSupportEscrow(requestId);
  }
  await prisma.hRSupportRequest.update({
    where: { id: requestId },
    data: { disputeResolvedAt: new Date(), disputeResolution: resolution },
  });
}

// The auto-release-with-no-dispute sweep — wired into routes/cron.ts + a
// server.ts in-process fallback, same pattern as autoReleaseMentorshipEscrows.
export async function autoReleaseHRSupportEscrows(): Promise<{ releasedIds: string[] }> {
  const due = await prisma.hRSupportRequest.findMany({
    where: { escrowStatus: 'HELD_IN_ESCROW', autoReleaseAt: { lte: new Date() }, disputeRaisedAt: null },
    select: { id: true },
  });
  const releasedIds: string[] = [];
  for (const { id } of due) {
    try {
      await releaseHRSupportEscrow(id, 'AUTO_RELEASE');
      releasedIds.push(id);
    } catch (err) {
      console.error(`[hrSupportEscrowService] autoRelease failed for request ${id}:`, err);
    }
  }
  return { releasedIds };
}
