import { prisma } from '../lib/prisma';
// Kept in sync with the 10% shown in the frontend Proposal Calculator (ProposalModal.tsx).
const PLATFORM_COMMISSION_RATE = 0.1;
export async function captureEscrow(params: {
  gigId: string;
  gigApplicationId: string;
  clientId: string;
  freelancerId: string;
  grossAmount: number;
  currency: string;
  providerRef: string;
}) {
  const commissionAmount = Math.round(params.grossAmount * PLATFORM_COMMISSION_RATE);
  const netAmount = params.grossAmount - commissionAmount;
  return prisma.gigTransaction.create({
    data: {
      gigId: params.gigId,
      gigApplicationId: params.gigApplicationId,
      clientId: params.clientId,
      freelancerId: params.freelancerId,
      grossAmount: params.grossAmount,
      currency: params.currency,
      providerRef: params.providerRef,
      commissionRate: PLATFORM_COMMISSION_RATE,
      commissionAmount,
      netAmount,
      status: 'HELD_IN_ESCROW',
      capturedAt: new Date(),
    },
  });
}
// Dispute resolved in the client's favor — marks escrow REFUNDED and does
// NOT credit the freelancer. Same posture as the course-payment refund
// path: this is a record-keeping action, the admin still processes the
// actual bank refund to the client via BOG separately.
export async function refundEscrow(gigId: string) {
  const transaction = await prisma.gigTransaction.findUnique({ where: { gigId } });
  if (!transaction) throw new Error('No escrow transaction found for this gig.');
  if (transaction.status !== 'HELD_IN_ESCROW') {
    throw new Error('Funds are not currently held in escrow.');
  }
  const [updatedTransaction] = await prisma.$transaction([
    prisma.gigTransaction.update({ where: { id: transaction.id }, data: { status: 'REFUNDED' } }),
    prisma.gig.update({ where: { id: gigId }, data: { status: 'cancelled' } }),
  ]);
  return updatedTransaction;
}

export async function releaseEscrow(gigId: string) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.gigTransaction.findUnique({ where: { gigId } });
    if (!transaction) throw new Error('No escrow transaction found for this gig.');

    // Atomically claim — if this gig's escrow was already released by a
    // concurrent call (e.g. a manual client approval racing the hourly
    // auto-approve cron on the same gig), claim.count is 0 and we abort
    // instead of double-crediting the freelancer.
    const claim = await tx.gigTransaction.updateMany({
      where: { id: transaction.id, status: 'HELD_IN_ESCROW' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new Error('Funds are not currently held in escrow.');
    }

    // Atomic increment — was previously a read-then-write
    // (earningsBalance + netAmount), a lost-update race if two different
    // gigs for the same freelancer were approved at nearly the same time.
    const freelancer = await tx.user.update({
      where: { id: transaction.freelancerId },
      data: { earningsBalance: { increment: transaction.netAmount } },
    });
    await tx.walletEntry.create({
      data: {
        userId: freelancer.id,
        type: 'ESCROW_RELEASE_CREDIT',
        amount: transaction.netAmount,
        relatedGigTransactionId: transaction.id,
        balanceAfter: freelancer.earningsBalance,
      },
    });
    await tx.gig.update({
      where: { id: gigId },
      data: { status: 'completed' },
    });
    return tx.gigTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
  });
}
