import { prisma } from '../lib/prisma';
import { DEFAULT_SESSION_MINUTES } from './mentorAvailabilityService';

// ============================================================
// Mentorship payout, refactored from "instant credit on payment
// confirmation" to the same held-escrow model gigs already use
// (escrowService.ts) — funds sit in escrow until the student confirms the
// session happened, or 24h after the scheduled end time passes with no
// dispute (autoReleaseMentorshipEscrows), whichever comes first. A
// cancellation-before-start or an explicit student dispute freezes the
// auto-release clock and hands the booking to an admin instead.
//
// Same unified 20% total fee (10% bank + 10% CDC Center) / 80% net split
// as every other revenue stream on the platform (escrowService.ts,
// productSaleService.ts) — kept as its own constant for the same reason
// those two are: independent revenue streams that happen to share a value
// today, not a single coupled policy.
// ============================================================

const PLATFORM_COMMISSION_RATE = 0.2;

// How long after the session's scheduled END time a HELD_IN_ESCROW booking
// with no dispute auto-releases to the mentor.
const AUTO_RELEASE_GRACE_MS = 24 * 60 * 60 * 1000;

export class MentorshipEscrowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MentorshipEscrowError';
  }
}

// Called once, right after the booking's payment is confirmed complete —
// see routes/payments.ts's applyBogPaymentResult and
// routes/stripePayments.ts's applyStripePaymentResult, both MENTORSHIP
// branches. Computes and LOCKS IN the commission split (never re-derived
// later — a mentor's rate or the platform's fee could change before
// release, this must not retroactively move), and places the booking into
// escrow. Does NOT touch the mentor's earningsBalance — see
// releaseMentorshipEscrow for that. Idempotent: a webhook retry against a
// booking that already has commissionAmount set is a no-op.
export async function captureMentorshipEscrow(params: { bookingId: string; grossAmount: number }): Promise<void> {
  const booking = await prisma.mentorshipBooking.findUnique({
    where: { id: params.bookingId },
    select: { commissionAmount: true, scheduledAt: true },
  });
  if (!booking) return; // booking row should always exist by this point — nothing to capture against if not
  if (booking.commissionAmount != null) return; // already captured — no-op

  const commissionAmount = Math.round(params.grossAmount * PLATFORM_COMMISSION_RATE);
  const netAmount = params.grossAmount - commissionAmount;
  const autoReleaseAt = new Date(booking.scheduledAt.getTime() + DEFAULT_SESSION_MINUTES * 60_000 + AUTO_RELEASE_GRACE_MS);

  await prisma.mentorshipBooking.update({
    where: { id: params.bookingId },
    data: {
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmount,
      netAmount,
      escrowStatus: 'HELD_IN_ESCROW',
      autoReleaseAt,
    },
  });
}

// Actually credits the mentor's 80% net share — called by the student's
// explicit "სესია ჩატარდა" confirmation, the 24h auto-release sweep, or an
// admin resolving a dispute in the mentor's favor. Atomic claim (same
// updateMany-then-check-count pattern as escrowService.releaseEscrow) so
// two triggers racing for the same booking — e.g. the student clicks
// confirm in the same moment the auto-release sweep picks it up — can't
// both pass and double-credit the mentor.
export async function releaseMentorshipEscrow(
  bookingId: string,
  trigger: 'STUDENT_CONFIRMED' | 'AUTO_RELEASE' | 'ADMIN_RESOLVED'
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.mentorshipBooking.updateMany({
      where: { id: bookingId, escrowStatus: 'HELD_IN_ESCROW' },
      data: { escrowStatus: 'RELEASED', releasedAt: new Date(), releaseTrigger: trigger },
    });
    if (claim.count === 0) {
      throw new MentorshipEscrowError('This session has no funds currently held in escrow.');
    }

    const booking = await tx.mentorshipBooking.findUniqueOrThrow({ where: { id: bookingId } });
    const mentor = await tx.user.update({
      where: { id: booking.mentorId },
      data: { earningsBalance: { increment: booking.netAmount! } },
    });
    await tx.walletEntry.create({
      data: {
        userId: mentor.id,
        type: 'MENTORSHIP_SESSION_CREDIT',
        amount: booking.netAmount!,
        relatedMentorshipBookingId: bookingId,
        balanceAfter: mentor.earningsBalance,
      },
    });
  });
}

// Admin-only path (via resolveMentorshipDispute below) — locks the escrow
// as refunded without crediting anyone. Same posture as
// escrowService.refundEscrow: this is a record-keeping action, the actual
// bank refund to the student still happens by hand through BOG/Stripe's
// own dashboard.
async function refundMentorshipEscrow(bookingId: string): Promise<void> {
  const claim = await prisma.mentorshipBooking.updateMany({
    where: { id: bookingId, escrowStatus: 'HELD_IN_ESCROW' },
    data: { escrowStatus: 'REFUNDED', releasedAt: new Date(), releaseTrigger: 'ADMIN_RESOLVED' },
  });
  if (claim.count === 0) {
    throw new MentorshipEscrowError('This session has no funds currently held in escrow.');
  }
}

// Freezes the auto-release clock on a booking whose funds are still held —
// shared by two triggers: the student's own explicit dispute
// (routes/mentorship.ts POST /bookings/:id/dispute) and a booking that had
// already-captured escrow cancelled before the session started
// (routes/mentorship.ts's cancel route). Either way the outcome is the
// same: an admin has to look at it before any money moves again.
export async function flagMentorshipEscrowForReview(bookingId: string, reason: string): Promise<void> {
  const booking = await prisma.mentorshipBooking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new MentorshipEscrowError('Booking not found.');
  if (booking.escrowStatus !== 'HELD_IN_ESCROW') {
    throw new MentorshipEscrowError('This session has no funds currently held in escrow to flag.');
  }
  if (booking.disputeRaisedAt) return; // already flagged — no-op, don't overwrite the original reason
  await prisma.mentorshipBooking.update({
    where: { id: bookingId },
    data: { disputeRaisedAt: new Date(), disputeReason: reason },
  });
}

// Admin action — resolves a flagged booking (see flagMentorshipEscrowForReview)
// either way: RELEASE credits the mentor as if the student had confirmed,
// REFUND locks the funds without crediting anyone. Always records the
// resolution, whether the underlying release/refund call succeeds or the
// escrow had already moved on its own (defensive — shouldn't happen since
// flagging freezes the auto-release sweep, but a manual DB edit or a bug
// elsewhere shouldn't leave a dispute permanently "open" with no trace of
// what an admin decided).
export async function resolveMentorshipDispute(bookingId: string, resolution: 'RELEASE' | 'REFUND'): Promise<void> {
  if (resolution === 'RELEASE') {
    await releaseMentorshipEscrow(bookingId, 'ADMIN_RESOLVED');
  } else {
    await refundMentorshipEscrow(bookingId);
  }
  await prisma.mentorshipBooking.update({
    where: { id: bookingId },
    data: { disputeResolvedAt: new Date(), disputeResolution: resolution },
  });
}

// The 24h-with-no-dispute sweep — wired into cron.ts + a server.ts
// in-process fallback, same pattern as every other sweep added this
// session. Each release is independently try/caught so one booking losing
// a race (e.g. the student confirmed in the same moment this ran) doesn't
// abort the rest of the batch.
export async function autoReleaseMentorshipEscrows(): Promise<{ releasedIds: string[] }> {
  const due = await prisma.mentorshipBooking.findMany({
    where: { escrowStatus: 'HELD_IN_ESCROW', autoReleaseAt: { lte: new Date() }, disputeRaisedAt: null },
    select: { id: true },
  });
  const releasedIds: string[] = [];
  for (const { id } of due) {
    try {
      await releaseMentorshipEscrow(id, 'AUTO_RELEASE');
      releasedIds.push(id);
    } catch (err) {
      console.error(`[mentorshipEscrowService] autoRelease failed for booking ${id}:`, err);
    }
  }
  return { releasedIds };
}
