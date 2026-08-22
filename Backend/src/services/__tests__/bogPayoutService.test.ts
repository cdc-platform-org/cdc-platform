import { prisma } from '../../lib/prisma';
import {
  evaluateRiskTier,
  hasOpenDisputesForUser,
  generateIdempotencyKey,
  processAutoApprovedPayouts,
  markFailed,
  markPaid,
  dispatchPayout,
  dispatchApprovedPayouts,
  reconcileStalePayouts,
  AUTO_APPROVAL_MAX_AMOUNT_TETRI,
  AUTO_APPROVAL_MIN_ACCOUNT_AGE_DAYS,
  AUTO_APPROVAL_IBAN_COOLDOWN_DAYS,
  BogPayoutNotConfiguredError,
} from '../bogPayoutService';
import { randomUUID } from 'crypto';
import { createUser, createPayoutRequest, createGig, createGigApplication } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

const OLD_ACCOUNT = new Date(Date.now() - (AUTO_APPROVAL_MIN_ACCOUNT_AGE_DAYS + 5) * 24 * 60 * 60 * 1000);
const VERIFIED_GRADUATE = { isVerifiedGraduate: true, verificationLevel: null, verificationStatus: null, isVerified: false };

function baseInput(overrides: Partial<Parameters<typeof evaluateRiskTier>[0]> = {}) {
  return {
    amount: 10_000,
    createdAt: OLD_ACCOUNT,
    payoutIbanUpdatedAt: null,
    hasOpenDisputes: false,
    ...VERIFIED_GRADUATE,
    ...overrides,
  };
}

describe('evaluateRiskTier', () => {
  it('clears a small, verified, old, dispute-free, IBAN-stable request as LOW risk', () => {
    const result = evaluateRiskTier(baseInput());
    expect(result).toEqual({ tier: 'LOW', reasons: [] });
  });

  it('flags an amount over the auto-approval max', () => {
    const result = evaluateRiskTier(baseInput({ amount: AUTO_APPROVAL_MAX_AMOUNT_TETRI + 1 }));
    expect(result.tier).toBe('MANUAL_REVIEW');
    expect(result.reasons.some((r) => r.includes('exceeds auto-approval max'))).toBe(true);
  });

  it('accepts exactly the auto-approval max amount', () => {
    const result = evaluateRiskTier(baseInput({ amount: AUTO_APPROVAL_MAX_AMOUNT_TETRI }));
    expect(result.tier).toBe('LOW');
  });

  it('flags an unverified identity', () => {
    const result = evaluateRiskTier(
      baseInput({ isVerifiedGraduate: false, verificationLevel: null, verificationStatus: null, isVerified: false })
    );
    expect(result.tier).toBe('MANUAL_REVIEW');
    expect(result.reasons.some((r) => r.includes('not verified'))).toBe(true);
  });

  it('flags an account younger than the minimum age', () => {
    const result = evaluateRiskTier(baseInput({ createdAt: new Date() }));
    expect(result.tier).toBe('MANUAL_REVIEW');
    expect(result.reasons.some((r) => r.includes('account age') || r.includes('Account age'))).toBe(true);
  });

  it('flags an open dispute', () => {
    const result = evaluateRiskTier(baseInput({ hasOpenDisputes: true }));
    expect(result.tier).toBe('MANUAL_REVIEW');
    expect(result.reasons.some((r) => r.includes('open dispute'))).toBe(true);
  });

  it('flags a payout IBAN changed within the cooldown window — the account-takeover mitigation', () => {
    const justChanged = new Date(Date.now() - 1000);
    const result = evaluateRiskTier(baseInput({ payoutIbanUpdatedAt: justChanged }));
    expect(result.tier).toBe('MANUAL_REVIEW');
    expect(result.reasons.some((r) => r.includes('cooldown'))).toBe(true);
  });

  it('clears a payout IBAN changed well outside the cooldown window', () => {
    const longAgo = new Date(Date.now() - (AUTO_APPROVAL_IBAN_COOLDOWN_DAYS + 1) * 24 * 60 * 60 * 1000);
    const result = evaluateRiskTier(baseInput({ payoutIbanUpdatedAt: longAgo }));
    expect(result.tier).toBe('LOW');
  });

  it('accumulates every failing rule into reasons, not just the first', () => {
    const result = evaluateRiskTier(
      baseInput({
        amount: AUTO_APPROVAL_MAX_AMOUNT_TETRI + 1,
        isVerifiedGraduate: false,
        hasOpenDisputes: true,
      })
    );
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe('generateIdempotencyKey', () => {
  it('is deterministic and follows the payout_request_<id> scheme', () => {
    expect(generateIdempotencyKey('abc-123')).toBe('payout_request_abc-123');
    expect(generateIdempotencyKey('abc-123')).toBe(generateIdempotencyKey('abc-123'));
  });
});

describe('hasOpenDisputesForUser', () => {
  it('returns false for a freelancer with no disputes', async () => {
    const freelancer = await createUser();
    expect(await hasOpenDisputesForUser(prisma, freelancer.id)).toBe(false);
  });

  it('returns true when an OPEN gig dispute exists against the assigned freelancer', async () => {
    const client = await createUser();
    const freelancer = await createUser();
    const gig = await createGig({ postedById: client.id, assignedFreelancerId: freelancer.id });
    await createGigApplication({ gigId: gig.id, applicantId: freelancer.id });
    await prisma.dispute.create({ data: { gigId: gig.id, raisedById: client.id, reason: 'Quality dispute.', status: 'OPEN' } });

    expect(await hasOpenDisputesForUser(prisma, freelancer.id)).toBe(true);
  });

  it('ignores a dispute already resolved (not status OPEN)', async () => {
    const client = await createUser();
    const freelancer = await createUser();
    const gig = await createGig({ postedById: client.id, assignedFreelancerId: freelancer.id });
    await createGigApplication({ gigId: gig.id, applicantId: freelancer.id });
    await prisma.dispute.create({
      data: { gigId: gig.id, raisedById: client.id, reason: 'Resolved already.', status: 'RESOLVED_PAYOUT' },
    });

    expect(await hasOpenDisputesForUser(prisma, freelancer.id)).toBe(false);
  });
});

describe('processAutoApprovedPayouts', () => {
  it('approves a PENDING/LOW-risk request, debits the balance, and writes a WalletEntry', async () => {
    const freelancer = await createUser({ earningsBalance: 20_000 });
    const request = await createPayoutRequest({ userId: freelancer.id, amount: 10_000, riskTier: 'LOW' });

    const result = await processAutoApprovedPayouts();
    expect(result.approvedIds).toContain(request.id);

    const updated = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe('APPROVED');
    expect(updated.autoApproved).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
    expect(user.earningsBalance).toBe(10_000);

    const entries = await prisma.walletEntry.findMany({ where: { userId: freelancer.id, type: 'PAYOUT_DEBIT' } });
    expect(entries).toHaveLength(1);
    expect(entries[0].amount).toBe(-10_000);
  });

  it('never touches a MANUAL_REVIEW request', async () => {
    const freelancer = await createUser({ earningsBalance: 20_000 });
    const request = await createPayoutRequest({ userId: freelancer.id, amount: 10_000, riskTier: 'MANUAL_REVIEW' });

    const result = await processAutoApprovedPayouts();
    expect(result.approvedIds).not.toContain(request.id);

    const unchanged = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  it("fails closed when the user's balance no longer covers the request", async () => {
    const freelancer = await createUser({ earningsBalance: 5_000 }); // less than the request below
    const request = await createPayoutRequest({ userId: freelancer.id, amount: 10_000, riskTier: 'LOW' });

    const result = await processAutoApprovedPayouts();
    expect(result.approvedIds).not.toContain(request.id);
    expect(result.failures.some((f) => f.id === request.id)).toBe(true);

    const unchanged = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe('PENDING'); // not silently approved anyway
    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
    expect(user.earningsBalance).toBe(5_000); // untouched
  });
});

describe('markFailed', () => {
  it('restores the balance and routes a PROCESSING request to FAILED', async () => {
    const freelancer = await createUser({ earningsBalance: 5_000 }); // already-debited balance, matching a claimed request
    const request = await createPayoutRequest({
      userId: freelancer.id,
      amount: 10_000,
      status: 'PROCESSING',
      autoApproved: true,
      processingStartedAt: new Date(),
    });

    await markFailed(request.id, 'BOG rejected the transfer.');

    const updated = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe('FAILED');
    expect(updated.failureReason).toBe('BOG rejected the transfer.');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
    expect(user.earningsBalance).toBe(15_000); // restored

    const reversal = await prisma.walletEntry.findMany({ where: { userId: freelancer.id, type: 'PAYOUT_REVERSAL' } });
    expect(reversal).toHaveLength(1);
    expect(reversal[0].amount).toBe(10_000);
  });

  it('is a safe no-op on a request that already resolved (not PROCESSING)', async () => {
    const freelancer = await createUser({ earningsBalance: 5_000 });
    const request = await createPayoutRequest({ userId: freelancer.id, amount: 10_000, status: 'PAID' });

    await markFailed(request.id, 'late duplicate failure callback');

    const unchanged = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe('PAID'); // not overwritten
    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
    expect(user.earningsBalance).toBe(5_000); // not double-restored
  });
});

describe('markPaid', () => {
  it('moves a PROCESSING request to PAID with the given providerRef', async () => {
    const freelancer = await createUser();
    const request = await createPayoutRequest({ userId: freelancer.id, status: 'PROCESSING' });

    const providerRef = `bog-transfer-${randomUUID()}`;
    await markPaid(request.id, providerRef);

    const updated = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe('PAID');
    expect(updated.providerRef).toBe(providerRef);
  });
});

describe('dispatchPayout (with the unimplemented BOG stub)', () => {
  it('claims the request into PROCESSING, then fails safe (restoring the balance) since callBogMassPayoutApi is not implemented', async () => {
    const freelancer = await createUser({ earningsBalance: 5_000 });
    const request = await createPayoutRequest({
      userId: freelancer.id,
      amount: 10_000,
      status: 'APPROVED',
      autoApproved: true,
    });

    await dispatchPayout(request.id);

    const updated = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe('FAILED');
    expect(updated.failureReason).toContain(new BogPayoutNotConfiguredError().message.slice(0, 20));

    // The claim's debit is reversed by the same failure path — no funds
    // are ever silently lost just because the provider isn't wired up yet.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
    expect(user.earningsBalance).toBe(15_000);
  });

  it('refuses to claim an APPROVED request that was not auto-approved (manual-review rows stay manual)', async () => {
    const freelancer = await createUser();
    const request = await createPayoutRequest({ userId: freelancer.id, status: 'APPROVED', autoApproved: false });

    await dispatchPayout(request.id);

    const unchanged = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(unchanged.status).toBe('APPROVED'); // never touched
  });
});

describe('dispatchApprovedPayouts', () => {
  it('sweeps every auto-approved APPROVED row', async () => {
    const freelancer = await createUser({ earningsBalance: 100_000 });
    const a = await createPayoutRequest({ userId: freelancer.id, amount: 1_000, status: 'APPROVED', autoApproved: true });
    const b = await createPayoutRequest({ userId: freelancer.id, amount: 2_000, status: 'APPROVED', autoApproved: true });
    const manual = await createPayoutRequest({ userId: freelancer.id, amount: 3_000, status: 'APPROVED', autoApproved: false });

    const result = await dispatchApprovedPayouts();
    expect(result.dispatchedIds).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(result.dispatchedIds).not.toContain(manual.id);
  });
});

describe('reconcileStalePayouts', () => {
  it('fails and restores balance for a PROCESSING row past the staleness timeout', async () => {
    const freelancer = await createUser({ earningsBalance: 0 });
    const staleRequest = await createPayoutRequest({
      userId: freelancer.id,
      amount: 5_000,
      status: 'PROCESSING',
      processingStartedAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago, past the 30m timeout
    });
    const freshRequest = await createPayoutRequest({
      userId: freelancer.id,
      amount: 5_000,
      status: 'PROCESSING',
      processingStartedAt: new Date(), // just started
    });

    const result = await reconcileStalePayouts();
    expect(result.failedIds).toContain(staleRequest.id);
    expect(result.failedIds).not.toContain(freshRequest.id);

    const stale = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: staleRequest.id } });
    expect(stale.status).toBe('FAILED');
    const fresh = await prisma.payoutRequest.findUniqueOrThrow({ where: { id: freshRequest.id } });
    expect(fresh.status).toBe('PROCESSING'); // untouched

    const user = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
    expect(user.earningsBalance).toBe(5_000); // only the stale one was restored
  });
});
