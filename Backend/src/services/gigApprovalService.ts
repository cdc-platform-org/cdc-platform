import { prisma } from '../lib/prisma';
import { releaseEscrow } from './escrowService';

const posterSelect = { select: { id: true, name: true, role: true, isVerifiedGraduate: true } };

export class GigApprovalError extends Error {}

// Shared by the client-triggered POST /gigs/:id/approve route and the 7-day
// auto-approve cron job — both just need "mark this submitted gig approved,
// release escrow to the freelancer," they differ only in who/what triggers it.
export async function approveGigWork(gigId: string) {
  const gig = await prisma.gig.findUnique({ where: { id: gigId } });
  if (!gig) {
    throw new GigApprovalError('Gig not found.');
  }
  if (gig.status !== 'submitted') {
    throw new GigApprovalError('This gig has no submitted work awaiting approval.');
  }
  // Checked here (not just in the cron's pre-filter query) so the
  // client-triggered POST /gigs/:id/approve route gets the same
  // protection — approving a gig releases escrow to the freelancer, which
  // must never happen while a dispute the client themselves may have
  // raised is still unresolved.
  const openDispute = await prisma.dispute.findFirst({ where: { gigId, status: 'OPEN' } });
  if (openDispute) {
    throw new GigApprovalError('This gig has an open dispute — resolve it before approving.');
  }

  const transaction = await releaseEscrow(gigId);
  const updatedGig = await prisma.gig.findUnique({
    where: { id: gigId },
    include: { postedBy: posterSelect, assignedFreelancer: posterSelect },
  });

  return { gig: updatedGig, transaction };
}

const AUTO_APPROVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface AutoApproveResult {
  processedGigIds: string[];
  failures: { gigId: string; error: string }[];
}

// Gigs sit in 'submitted' waiting on the client's review. If the client
// never responds, the freelancer shouldn't be stuck unpaid indefinitely —
// after 7 days from submittedAt, treat it as approved automatically and
// release escrow, same as if the client had clicked approve themselves.
export async function autoApproveOverdueGigs(): Promise<AutoApproveResult> {
  const cutoff = new Date(Date.now() - AUTO_APPROVE_AFTER_MS);
  // Opening a dispute (POST /gigs/:id/dispute) never moves gig.status off
  // 'submitted' — it only inserts a Dispute row — so without this exclusion
  // the cron would happily auto-approve (and release escrow to the
  // freelancer) a gig the client has explicitly flagged as bad/non-
  // delivered work, out from under an unresolved OPEN dispute. A gig can
  // have at most one live dispute in practice, but `none` is correct even
  // if that ever changes.
  const overdueGigs = await prisma.gig.findMany({
    where: { status: 'submitted', submittedAt: { lte: cutoff }, disputes: { none: { status: 'OPEN' } } },
    select: { id: true },
  });

  const processedGigIds: string[] = [];
  const failures: { gigId: string; error: string }[] = [];

  for (const { id } of overdueGigs) {
    try {
      await approveGigWork(id);
      processedGigIds.push(id);
    } catch (err: any) {
      failures.push({ gigId: id, error: err?.message ?? 'Unknown error' });
    }
  }

  return { processedGigIds, failures };
}
