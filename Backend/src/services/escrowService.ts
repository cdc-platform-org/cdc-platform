import { prisma } from '../lib/prisma';
import { hasFreelancerRights } from '../utils/freelancerVerification';

// Bank/payment-processing gateway slice is fixed regardless of
// verification — only CDC's own platform-fee slice moves, as the
// verification incentive: 15% for an unverified freelancer (25% total) vs
// 10% for one with freelancer rights (hasFreelancerRights — course/skill-
// exam graduate or admin-approved individual verification; see
// utils/freelancerVerification.ts), 20% total. Same split shown in the
// frontend Proposal Calculator (ProposalModal.tsx).
const BANK_FEE_RATE = 0.1;
const PLATFORM_FEE_RATE_UNVERIFIED = 0.15;
const PLATFORM_FEE_RATE_VERIFIED = 0.1;

export async function captureEscrow(params: {
  gigId: string;
  gigApplicationId: string;
  clientId: string;
  freelancerId: string;
  grossAmount: number;
  currency: string;
  providerRef: string;
}) {
  // Verification status is checked and locked in right here, at capture
  // time — not re-derived at release. A freelancer who verifies mid-gig
  // doesn't retroactively lower the commission on an already-funded escrow;
  // the discount applies to the next gig they get paid for.
  const freelancer = await prisma.user.findUnique({
    where: { id: params.freelancerId },
    select: { isVerifiedGraduate: true, verificationLevel: true, verificationStatus: true },
  });
  const verified = !!freelancer && hasFreelancerRights(freelancer);
  const commissionRate = BANK_FEE_RATE + (verified ? PLATFORM_FEE_RATE_VERIFIED : PLATFORM_FEE_RATE_UNVERIFIED);
  const commissionAmount = Math.round(params.grossAmount * commissionRate);
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
      commissionRate,
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

  // Atomic claim, same pattern and same reason as releaseEscrow's own claim
  // below — without it, this racing releaseEscrow (e.g. the hourly
  // auto-approve cron firing around the same time an admin resolves a
  // dispute) could both pass their initial status check, then both commit:
  // the freelancer already credited by releaseEscrow, while this call's
  // unconditional update still overwrites the transaction to REFUNDED and
  // the gig to 'cancelled' — an accounting mismatch with no way to recover
  // which one "actually" happened.
  const claim = await prisma.gigTransaction.updateMany({
    where: { id: transaction.id, status: 'HELD_IN_ESCROW' },
    data: { status: 'REFUNDED' },
  });
  if (claim.count === 0) {
    throw new Error('Funds are not currently held in escrow.');
  }
  await prisma.gig.update({ where: { id: gigId }, data: { status: 'cancelled' } });
  return prisma.gigTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
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
