import { prisma } from '../../lib/prisma';
import { captureEscrow, releaseEscrow, refundEscrow } from '../escrowService';
import { upsertCommissionPercentage } from '../platformFeeScheduleService';
import { createUser, createVerifiedFreelancer, createUnverifiedFreelancer, setupHeldGigEscrow, createGig } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('escrowService', () => {
  describe('captureEscrow — commission from PlatformFeeSchedule', () => {
    it('charges the GIG_UNVERIFIED rate for a freelancer with no verification', async () => {
      await upsertCommissionPercentage('GIG_UNVERIFIED', 25, 'test');
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { transaction } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        grossAmount: 100000,
      });

      expect(transaction.commissionRate).toBeCloseTo(0.25);
      expect(transaction.commissionAmount).toBe(25000);
      expect(transaction.netAmount).toBe(75000);
      expect(transaction.status).toBe('HELD_IN_ESCROW');
    });

    it('charges the lower GIG_VERIFIED rate for a graduate-verified freelancer', async () => {
      await upsertCommissionPercentage('GIG_VERIFIED', 20, 'test');
      const client = await createUser();
      const freelancer = await createVerifiedFreelancer();
      const { transaction } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        grossAmount: 100000,
      });

      expect(transaction.commissionRate).toBeCloseTo(0.2);
      expect(transaction.commissionAmount).toBe(20000);
      expect(transaction.netAmount).toBe(80000);
    });

    it('locks the rate at capture time — a later PlatformFeeSchedule change does not retroactively move it', async () => {
      await upsertCommissionPercentage('GIG_UNVERIFIED', 25, 'test');
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { transaction } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        grossAmount: 100000,
      });

      await upsertCommissionPercentage('GIG_UNVERIFIED', 40, 'test');

      const reloaded = await prisma.gigTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
      expect(reloaded.commissionAmount).toBe(25000); // unchanged, not 40000
    });
  });

  describe('releaseEscrow', () => {
    it('credits the freelancer net amount, writes a WalletEntry, and marks the gig completed', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const before = freelancer.earningsBalance;
      const { gig, transaction } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        grossAmount: 100000,
      });

      const released = await releaseEscrow(gig.id);
      expect(released.status).toBe('RELEASED');

      const updatedFreelancer = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
      expect(updatedFreelancer.earningsBalance).toBe(before + transaction.netAmount);

      const walletEntries = await prisma.walletEntry.findMany({ where: { relatedGigTransactionId: transaction.id } });
      expect(walletEntries).toHaveLength(1);
      expect(walletEntries[0].amount).toBe(transaction.netAmount);
      expect(walletEntries[0].balanceAfter).toBe(updatedFreelancer.earningsBalance);

      const updatedGig = await prisma.gig.findUniqueOrThrow({ where: { id: gig.id } });
      expect(updatedGig.status).toBe('completed');
    });

    it('rejects releasing a gig with no escrow transaction', async () => {
      const client = await createUser();
      const gig = await createGig({ postedById: client.id });
      await expect(releaseEscrow(gig.id)).rejects.toThrow('No escrow transaction found for this gig.');
    });

    it('rejects a second release of an already-released gig', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({ clientId: client.id, freelancerId: freelancer.id });

      await releaseEscrow(gig.id);
      await expect(releaseEscrow(gig.id)).rejects.toThrow('Funds are not currently held in escrow.');
    });

    it('atomic claim: two concurrent releases of the same gig credit the freelancer exactly once', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const before = freelancer.earningsBalance;
      const { gig, transaction } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        grossAmount: 100000,
      });

      const results = await Promise.allSettled([releaseEscrow(gig.id), releaseEscrow(gig.id)]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one of the two racing calls wins the atomic claim.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const updatedFreelancer = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
      expect(updatedFreelancer.earningsBalance).toBe(before + transaction.netAmount);

      const walletEntries = await prisma.walletEntry.findMany({ where: { relatedGigTransactionId: transaction.id } });
      expect(walletEntries).toHaveLength(1); // not double-credited
    });
  });

  describe('refundEscrow', () => {
    it('marks the transaction REFUNDED and the gig cancelled, without crediting the freelancer', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const before = freelancer.earningsBalance;
      const { gig, transaction } = await setupHeldGigEscrow({ clientId: client.id, freelancerId: freelancer.id });

      const refunded = await refundEscrow(gig.id);
      expect(refunded.status).toBe('REFUNDED');

      const updatedGig = await prisma.gig.findUniqueOrThrow({ where: { id: gig.id } });
      expect(updatedGig.status).toBe('cancelled');

      const updatedFreelancer = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
      expect(updatedFreelancer.earningsBalance).toBe(before);

      void transaction;
    });

    it('rejects refunding an already-refunded transaction', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({ clientId: client.id, freelancerId: freelancer.id });

      await refundEscrow(gig.id);
      await expect(refundEscrow(gig.id)).rejects.toThrow('Funds are not currently held in escrow.');
    });

    it('race: refundEscrow cannot overwrite an already-released transaction (and vice versa)', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const before = freelancer.earningsBalance;
      const { gig, transaction } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        grossAmount: 100000,
      });

      const results = await Promise.allSettled([releaseEscrow(gig.id), refundEscrow(gig.id)]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1); // exactly one of release/refund wins

      const finalTransaction = await prisma.gigTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
      const updatedFreelancer = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });

      if (finalTransaction.status === 'RELEASED') {
        // The freelancer was credited exactly once, matching the winning release.
        expect(updatedFreelancer.earningsBalance).toBe(before + transaction.netAmount);
      } else {
        // REFUNDED won the race — freelancer must NOT have been credited at all.
        expect(finalTransaction.status).toBe('REFUNDED');
        expect(updatedFreelancer.earningsBalance).toBe(before);
      }
    });
  });
});
