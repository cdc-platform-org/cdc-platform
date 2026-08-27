import { prisma } from '../lib/prisma';
import { hasFreelancerRights } from '../utils/freelancerVerification';
import { getCommissionRate } from './platformFeeScheduleService';

// Total commission rate (bank/payment-gateway slice + CDC's own platform
// slice, no longer split into separate constants) comes from
// PlatformFeeSchedule — GIG_UNVERIFIED (25% by default) vs GIG_VERIFIED
// (20% by default), the verification incentive: an unverified freelancer
// pays more (hasFreelancerRights — course/skill-exam graduate or
// admin-approved individual verification; see
// utils/freelancerVerification.ts). Admin-editable at /admin/commissions.
// Same split shown in the frontend Proposal Calculator (ProposalModal.tsx).

// Safe to call more than once for the same gig — a BOG webhook retry and the
// /bog/status poll fallback (or, on the Stripe side, its own webhook +
// status-poll pair) are expected to race here by design, same as this
// codebase's other seller-credit paths. Previously a plain `create()`
// relying only on the caller's own pre-check (a separate findUnique) plus
// GigTransaction.gigId's unique constraint as the last line of defense — a
// real check-then-act race: two concurrent callers could both pass the
// pre-check, and the loser's create() would throw an unhandled P2002
// instead of the graceful no-op every other capture function in this
// codebase gives. `createMany({ skipDuplicates: true })` makes the "am I
// first" check itself atomic (compiles to `INSERT ... ON CONFLICT DO
// NOTHING`, so a losing concurrent call reports a 0-row insert rather than
// throwing) — the loser just reads back the row the winner created.
//
// Deliberately not wrapped in a $transaction: unlike releaseEscrow (which
// conditionally credits earningsBalance and so needs its claim + credit to
// commit atomically together), this function never moves money — it only
// locks in a commission split — so there's nothing that needs to roll back
// together with the insert, and createMany's ON CONFLICT DO NOTHING is
// already atomic as a single SQL statement on its own.
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
  const commissionRate = await getCommissionRate(verified ? 'GIG_VERIFIED' : 'GIG_UNVERIFIED');
  const commissionAmount = Math.round(params.grossAmount * commissionRate);
  const netAmount = params.grossAmount - commissionAmount;

  await prisma.gigTransaction.createMany({
    data: [
      {
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
    ],
    skipDuplicates: true,
  });

  return prisma.gigTransaction.findUniqueOrThrow({ where: { gigId: params.gigId } });
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
