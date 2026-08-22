import { Prisma, PayoutRequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isIdentityVerified } from '../utils/freelancerVerification';

// ============================================================
// BOG (Bank of Georgia) automated payout engine — hybrid model.
//
// Every PayoutRequest still goes through exactly the creation/approve/
// reject flow that already exists (routes/wallet.ts, routes/adminPayouts.ts)
// — this file does not replace that, it adds a second, automated path for
// the subset of requests the risk engine below is willing to vouch for,
// and a shared BOG-dispatch step for anything that reaches APPROVED either
// way. State machine:
//
//   PENDING
//     ├─ riskTier=LOW,  processAutoApprovedPayouts() sweep  → APPROVED (autoApproved=true, balance debited)
//     ├─ SUPER_ADMIN POST /admin/payouts/:id/approve        → APPROVED (existing route, unchanged, balance debited)
//     └─ SUPER_ADMIN POST /admin/payouts/:id/reject         → REJECTED (existing route, unchanged, terminal)
//
//   APPROVED  (balance already debited — same "commit at approval, not at
//              confirmed-paid" semantics for both the auto and human path,
//              so a fresh payout request's balance check always reflects
//              every already-committed one, auto or manual, the same way)
//     ├─ dispatchApprovedPayouts() sweep, only rows with autoApproved=true
//     │  → claimForProcessing() → PROCESSING
//     └─ admin's existing POST /admin/payouts/:id/mark-paid (manual wire,
//        unchanged) → PAID directly, still available for any APPROVED row
//        an admin chooses to handle by hand instead of letting BOG dispatch
//        pick it up — including ones the risk engine itself cleared, if an
//        admin would rather not automate a specific one.
//
//   PROCESSING  (funds locked; the one BOG API call/webhook round trip)
//     ├─ BOG accepts the transfer, providerRef stored, awaiting webhook
//     │    ├─ webhook confirms success  → PAID
//     │    └─ webhook confirms failure, OR reconcileStalePayouts() finds no
//     │       webhook arrived within the timeout → markFailed() → FAILED
//     │       (balance RESTORED, routed to Admin Review Queue)
//     └─ the API call itself throws (network/4xx/5xx before BOG even
//        accepted it) → markFailed() → FAILED (balance restored)
//
// FAILED is always terminal-but-flagged, never auto-retried — a human
// decides from the Admin Review Queue whether to re-approve a fresh
// request, wire it by hand, or reject and notify the user. Auto-retry on a
// payment-adjacent failure is exactly the kind of "fail-safe" violation
// this design exists to avoid.
//
// NOT wired into any route/cron in this pass — see callBogMassPayoutApi's
// own comment for why, and the audit this file was designed alongside for
// the account-takeover-via-IBAN-change vulnerability this risk engine's
// ibanCooldown rule specifically closes (routes/auth.ts PUT /me).
// ============================================================

// ---- Auto-approval rule thresholds ----------------------------------

// GEL, minor units (tetri) — matches every other Int money field's
// convention in this codebase.
export const AUTO_APPROVAL_MAX_AMOUNT_TETRI = 50_000; // 500.00 GEL
export const AUTO_APPROVAL_MIN_ACCOUNT_AGE_DAYS = 30;
// Mirrors User.payoutIbanUpdatedAt's own schema comment — any payout
// requested within this window of an IBAN change is forced to manual
// review regardless of amount, closing the account-takeover vector where a
// hijacked session redirects payouts and immediately cashes out.
export const AUTO_APPROVAL_IBAN_COOLDOWN_DAYS = 3;
// Stale-PROCESSING timeout — see reconcileStalePayouts(). Generous on
// purpose: a real bank transfer confirmation can legitimately take a while,
// and flagging too eagerly just means more manual-review noise, whereas
// flagging too late leaves funds in limbo longer than necessary. Tune once
// BOG's actual typical confirmation latency is known.
export const PROCESSING_STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RiskEvaluationInput {
  amount: number; // minor units
  createdAt: Date; // User.createdAt — account age
  payoutIbanUpdatedAt: Date | null;
  isVerifiedGraduate: boolean;
  verificationLevel: string | null;
  verificationStatus: string | null;
  isVerified: boolean;
  hasOpenDisputes: boolean;
  // True when sessionAnomalyService.detectSessionAnomaly found this
  // request's IP/device doesn't match the user's recent login history —
  // computed by the caller (routes/wallet.ts), not by this function,
  // same "look up what's true" / "decide what happens" split as
  // hasOpenDisputes above.
  sessionAnomaly: boolean;
}

// Exact wording contract — the Admin Review Queue and any downstream
// alerting matches on this string, so treat it as a stable identifier, not
// prose to casually reword.
export const SESSION_ANOMALY_REASON = 'RED_FLAG: Payout requested from an unrecognized IP address or device';

export interface RiskEvaluationResult {
  tier: 'LOW' | 'MANUAL_REVIEW';
  // Every rule that actually failed — stored nowhere on the row itself
  // (the row only keeps the final tier), but returned so the caller can
  // fold it into PayoutRequest.adminNote for an auto-approved row ("why
  // did the engine clear this one") or surface it directly in the Admin
  // Review Queue for a MANUAL_REVIEW one ("why does this need a human").
  reasons: string[];
}

// Pure function — no I/O, fully unit-testable without a database. The
// disputes check is the one input that needs a query; callers fetch it
// separately (see hasOpenDisputesForUser) so this function stays a plain
// decision table over already-known facts, same separation escrowService.ts
// keeps between "look up what's true" and "decide what happens."
export function evaluateRiskTier(input: RiskEvaluationInput): RiskEvaluationResult {
  const reasons: string[] = [];

  if (input.amount > AUTO_APPROVAL_MAX_AMOUNT_TETRI) {
    reasons.push(`Amount ${input.amount} exceeds auto-approval max ${AUTO_APPROVAL_MAX_AMOUNT_TETRI}.`);
  }
  if (
    !isIdentityVerified({
      isVerifiedGraduate: input.isVerifiedGraduate,
      verificationLevel: input.verificationLevel,
      verificationStatus: input.verificationStatus,
      isVerified: input.isVerified,
    })
  ) {
    reasons.push('Identity is not verified.');
  }
  const accountAgeDays = (Date.now() - input.createdAt.getTime()) / DAY_MS;
  if (accountAgeDays < AUTO_APPROVAL_MIN_ACCOUNT_AGE_DAYS) {
    reasons.push(`Account age ${accountAgeDays.toFixed(1)}d is under the ${AUTO_APPROVAL_MIN_ACCOUNT_AGE_DAYS}d minimum.`);
  }
  if (input.hasOpenDisputes) {
    reasons.push('At least one open dispute is associated with this user.');
  }
  if (input.payoutIbanUpdatedAt) {
    const ibanAgeDays = (Date.now() - input.payoutIbanUpdatedAt.getTime()) / DAY_MS;
    if (ibanAgeDays < AUTO_APPROVAL_IBAN_COOLDOWN_DAYS) {
      reasons.push(`Payout IBAN was changed ${ibanAgeDays.toFixed(1)}d ago, within the ${AUTO_APPROVAL_IBAN_COOLDOWN_DAYS}d cooldown.`);
    }
  }
  // PSD2/SCA + OWASP ATO-prevention rule: an IP/device that doesn't match
  // the account's recent login history is grounds for manual review on
  // its own, independent of every other rule above — a small, old,
  // fully-verified, dispute-free account can still be the victim of a
  // session/account takeover, and amount/age/verification alone would
  // auto-approve straight through it. This rule cannot be bypassed by
  // clearing every other rule; it strictly forces MANUAL_REVIEW whenever
  // it fires (see the function's return below — reasons.length > 0 always
  // means MANUAL_REVIEW, no rule is ever "soft").
  if (input.sessionAnomaly) {
    reasons.push(SESSION_ANOMALY_REASON);
  }

  return { tier: reasons.length === 0 ? 'LOW' : 'MANUAL_REVIEW', reasons };
}

// Checked across every revenue stream that credits earningsBalance — an
// open dispute anywhere is grounds for manual review, not just on the gig
// this specific payout happens to be "about" (a payout is a withdrawal of
// the whole balance, not earmarked per gig/booking/request).
export async function hasOpenDisputesForUser(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string
): Promise<boolean> {
  const [openGigDispute, openMentorshipDispute, openHrDispute] = await Promise.all([
    tx.dispute.findFirst({
      where: { status: 'OPEN', gig: { assignedFreelancerId: userId } },
      select: { id: true },
    }),
    tx.mentorshipBooking.findFirst({
      where: { mentorId: userId, disputeRaisedAt: { not: null }, disputeResolvedAt: null },
      select: { id: true },
    }),
    tx.hRSupportRequest.findFirst({
      where: { assignedSpecialistId: userId, disputeRaisedAt: { not: null }, disputeResolvedAt: null },
      select: { id: true },
    }),
  ]);
  return !!(openGigDispute || openMentorshipDispute || openHrDispute);
}

export function generateIdempotencyKey(payoutRequestId: string): string {
  return `payout_request_${payoutRequestId}`;
}

export class PayoutClaimError extends Error {}
export class BogPayoutNotConfiguredError extends Error {
  constructor() {
    super(
      'BOG Mass Payout API is not implemented yet — no real disbursement endpoint, credentials, or confirmed request/response contract exist in this codebase. See callBogMassPayoutApi\'s own comment.'
    );
    this.name = 'BogPayoutNotConfiguredError';
  }
}

// ---- Sweep 1: PENDING + riskTier=LOW -> APPROVED --------------------

export interface AutoApprovalResult {
  approvedIds: string[];
  failures: { id: string; error: string }[];
}

// Cron-style sweep, same shape as autoApproveOverdueGigs / auto
// ReleaseMentorshipEscrows — never called from a user-facing request
// handler, so a slow or momentarily-unavailable balance check here never
// adds latency to POST /wallet/payout-requests itself. Re-validates the
// balance at approval time (same guard adminPayouts.ts's human /approve
// route already has) since a request can sit PENDING for a while and nothing
// stops other approvals from draining the same balance in the meantime.
export async function processAutoApprovedPayouts(): Promise<AutoApprovalResult> {
  const candidates = await prisma.payoutRequest.findMany({
    where: { status: PayoutRequestStatus.PENDING, riskTier: 'LOW' },
    select: { id: true },
  });

  const approvedIds: string[] = [];
  const failures: { id: string; error: string }[] = [];

  for (const { id } of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        const request = await tx.payoutRequest.findUniqueOrThrow({ where: { id } });
        const user = await tx.user.findUniqueOrThrow({ where: { id: request.userId }, select: { earningsBalance: true } });
        if (user.earningsBalance < request.amount) {
          throw new PayoutClaimError("The user's balance no longer covers this request.");
        }
        const claim = await tx.payoutRequest.updateMany({
          where: { id, status: PayoutRequestStatus.PENDING },
          data: { status: PayoutRequestStatus.APPROVED, autoApproved: true, resolvedAt: new Date(), adminNote: 'Auto-approved by BOG payout risk engine.' },
        });
        if (claim.count === 0) throw new PayoutClaimError('Already resolved by a concurrent action.');

        const updatedUser = await tx.user.update({
          where: { id: request.userId },
          data: { earningsBalance: { decrement: request.amount } },
        });
        await tx.walletEntry.create({
          data: { userId: request.userId, type: 'PAYOUT_DEBIT', amount: -request.amount, balanceAfter: updatedUser.earningsBalance },
        });
      });
      approvedIds.push(id);
    } catch (err) {
      failures.push({ id, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return { approvedIds, failures };
}

// ---- Sweep 2: APPROVED (auto-approved only) -> PROCESSING -> BOG ----

// Atomically claims one APPROVED, auto-approved request for BOG dispatch —
// same updateMany-then-check-count pattern as escrowService.releaseEscrow,
// so two sweep runs (or a sweep racing a manual /mark-paid on the same row)
// can't both claim it. Deliberately does NOT touch earningsBalance here —
// it was already debited when the row became APPROVED (see the module
// header comment for why that timing is shared with the manual path).
async function claimForProcessing(payoutRequestId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.payoutRequest.updateMany({
      where: { id: payoutRequestId, status: PayoutRequestStatus.APPROVED, autoApproved: true },
      data: { status: PayoutRequestStatus.PROCESSING, processingStartedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new PayoutClaimError('This request is not an auto-approved row currently awaiting dispatch.');
    }
    return tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutRequestId } });
  });
}

// Reverses claimForProcessing's debit and routes the request to the Admin
// Review Queue — called both for an immediate API-call error and for a
// PROCESSING row whose webhook never arrived (see reconcileStalePayouts).
// Atomic claim guards the same race as everywhere else in this file: a
// failure callback and a late-arriving success webhook racing for the same
// row must not both apply.
export async function markFailed(payoutRequestId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.payoutRequest.updateMany({
      where: { id: payoutRequestId, status: PayoutRequestStatus.PROCESSING },
      data: { status: PayoutRequestStatus.FAILED, failedAt: new Date(), failureReason: reason },
    });
    if (claim.count === 0) return; // already resolved by a concurrent success/failure — no-op, not an error

    const request = await tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutRequestId } });
    const updatedUser = await tx.user.update({
      where: { id: request.userId },
      data: { earningsBalance: { increment: request.amount } },
    });
    await tx.walletEntry.create({
      data: { userId: request.userId, type: 'PAYOUT_REVERSAL', amount: request.amount, balanceAfter: updatedUser.earningsBalance },
    });
  });
}

export async function markPaid(payoutRequestId: string, providerRef: string): Promise<void> {
  await prisma.payoutRequest.updateMany({
    where: { id: payoutRequestId, status: PayoutRequestStatus.PROCESSING },
    data: { status: PayoutRequestStatus.PAID, providerRef },
  });
}

// ---- The actual bank call — NOT IMPLEMENTED ---------------------------
//
// Same posture as paymentGatewayService.chargeCard's own "deferred real-
// charge phase" stub: this exists so the rest of the engine (risk rules,
// state machine, idempotency, failure handling — everything above) can be
// built, reviewed, and tested against a real database today, without
// pretending a live bank disbursement integration exists yet. Before this
// can throw anything other than BogPayoutNotConfiguredError, the following
// need to be confirmed and are NOT currently known from anything in this
// codebase:
//   - The actual BOG Mass Payout / disbursement API endpoint and whether
//     it lives under the same api.bog.ge / oauth2.bog.ge surface
//     bogPaymentService.ts already talks to, or is a separate business-
//     banking product requiring its own agreement and credentials.
//   - Its authentication scheme (the existing OAuth2 client-credentials
//     flow may not extend to a disbursement scope).
//   - Whether it accepts a client-supplied idempotency key directly (the
//     `idempotencyKey` param below assumes this — verify against BOG's
//     actual contract before relying on it) and what a duplicate-key
//     retry actually returns.
//   - Whether a successful response is itself final confirmation, or (as
//     assumed throughout this file, matching the ecommerce Payments API's
//     own create-order-then-callback shape) only "accepted," with a
//     separate webhook confirming success/failure — this determines
//     whether markPaid is ever called synchronously from here at all.
export async function callBogMassPayoutApi(_params: {
  idempotencyKey: string;
  iban: string;
  amountTetri: number;
  currency: 'GEL';
}): Promise<{ providerRef: string }> {
  throw new BogPayoutNotConfiguredError();
}

// ---- Sweep 3: stale PROCESSING with no webhook -----------------------

export async function reconcileStalePayouts(): Promise<{ failedIds: string[] }> {
  const cutoff = new Date(Date.now() - PROCESSING_STALE_AFTER_MS);
  const stale = await prisma.payoutRequest.findMany({
    where: { status: PayoutRequestStatus.PROCESSING, processingStartedAt: { lte: cutoff } },
    select: { id: true },
  });
  for (const { id } of stale) {
    await markFailed(id, 'No confirmation from BOG within the processing timeout.');
  }
  return { failedIds: stale.map((r) => r.id) };
}

// ---- Orchestration: claim + dispatch one row --------------------------
//
// Ties claimForProcessing (DB-only, atomic) to the actual network call
// (deliberately outside any transaction — a transaction must never hold
// open across an HTTP round trip). Not itself wired into a route/cron in
// this pass — see the module header.
export async function dispatchPayout(payoutRequestId: string): Promise<void> {
  let claimed;
  try {
    claimed = await claimForProcessing(payoutRequestId);
  } catch (err) {
    if (err instanceof PayoutClaimError) return; // not eligible (already claimed, resolved, or not auto-approved) — safe no-op, nothing was debited to restore
    throw err;
  }
  try {
    const { providerRef } = await callBogMassPayoutApi({
      idempotencyKey: claimed.idempotencyKey,
      iban: claimed.iban,
      amountTetri: claimed.amount,
      currency: 'GEL',
    });
    // Per callBogMassPayoutApi's own comment: whether this alone means PAID
    // or only "accepted, awaiting webhook" depends on BOG's actual contract.
    // Recording providerRef now either way is safe and useful for
    // reconciliation regardless of which turns out to be true.
    await prisma.payoutRequest.updateMany({
      where: { id: payoutRequestId, status: PayoutRequestStatus.PROCESSING },
      data: { providerRef },
    });
  } catch (err) {
    await markFailed(payoutRequestId, err instanceof Error ? err.message : 'Unknown BOG API error.');
  }
}

export async function dispatchApprovedPayouts(): Promise<{ dispatchedIds: string[]; failures: { id: string; error: string }[] }> {
  const candidates = await prisma.payoutRequest.findMany({
    where: { status: PayoutRequestStatus.APPROVED, autoApproved: true },
    select: { id: true },
  });
  const dispatchedIds: string[] = [];
  const failures: { id: string; error: string }[] = [];
  // Same per-item isolation as every other sweep in this codebase
  // (autoApproveOverdueGigs, autoReleaseMentorshipEscrows) — dispatchPayout
  // itself already catches both its own failure modes internally and
  // should never throw, but one row's unexpected error still must not
  // abort the rest of the batch.
  for (const { id } of candidates) {
    try {
      await dispatchPayout(id);
      dispatchedIds.push(id);
    } catch (err) {
      failures.push({ id, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }
  return { dispatchedIds, failures };
}
