import { prisma } from '../lib/prisma';

// Same unified 20% total fee (10% bank + 10% CDC Center) / 80% net split as
// every other revenue stream on the platform (escrowService.ts,
// productSaleService.ts) — kept as its own constant for the same reason
// those two are: independent revenue streams that happen to share a value
// today, not a single coupled policy.
const PLATFORM_COMMISSION_RATE = 0.2;

// Credits the mentor's 80% net share for a completed session payment — see
// routes/payments.ts's applyBogPaymentResult MENTORSHIP branch, called once
// per booking right after the BogPayment is marked COMPLETED. Idempotent:
// a webhook retry re-running against a booking that already has
// commissionAmount set is a no-op, never double-credits (mirrors
// productSaleService.completeProductPurchase's guard).
export async function creditMentorshipSession(params: {
  bookingId: string;
  mentorId: string;
  grossAmount: number;
  currency: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.mentorshipBooking.findUnique({
      where: { id: params.bookingId },
      select: { commissionAmount: true },
    });
    if (booking?.commissionAmount != null) return; // already credited — no-op

    const commissionAmount = Math.round(params.grossAmount * PLATFORM_COMMISSION_RATE);
    const netAmount = params.grossAmount - commissionAmount;

    await tx.mentorshipBooking.update({
      where: { id: params.bookingId },
      data: { commissionRate: PLATFORM_COMMISSION_RATE, commissionAmount, netAmount },
    });
    const mentor = await tx.user.update({
      where: { id: params.mentorId },
      data: { earningsBalance: { increment: netAmount } },
    });
    await tx.walletEntry.create({
      data: {
        userId: mentor.id,
        type: 'MENTORSHIP_SESSION_CREDIT',
        amount: netAmount,
        relatedMentorshipBookingId: params.bookingId,
        balanceAfter: mentor.earningsBalance,
      },
    });
  });
}
