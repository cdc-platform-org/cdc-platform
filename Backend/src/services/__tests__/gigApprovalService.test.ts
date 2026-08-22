import { prisma } from '../../lib/prisma';
import { approveGigWork, autoApproveOverdueGigs, GigApprovalError } from '../gigApprovalService';
import { createUser, createUnverifiedFreelancer, setupHeldGigEscrow } from '../../test/factories';
import { GigStatus, DisputeStatus } from '@prisma/client';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('gigApprovalService', () => {
  describe('approveGigWork', () => {
    it('releases escrow and marks the gig completed for a normal submitted gig', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({ clientId: client.id, freelancerId: freelancer.id });

      const result = await approveGigWork(gig.id);
      expect(result.transaction.status).toBe('RELEASED');
      expect(result.gig?.status).toBe('completed');
    });

    it('refuses to approve (and release escrow for) a gig with an OPEN dispute', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const before = freelancer.earningsBalance;
      const { gig } = await setupHeldGigEscrow({ clientId: client.id, freelancerId: freelancer.id });

      await prisma.dispute.create({
        data: { gigId: gig.id, raisedById: client.id, reason: 'Work not delivered as agreed.', status: DisputeStatus.OPEN },
      });

      await expect(approveGigWork(gig.id)).rejects.toThrow(GigApprovalError);
      await expect(approveGigWork(gig.id)).rejects.toThrow('open dispute');

      const transaction = await prisma.gigTransaction.findUniqueOrThrow({ where: { gigId: gig.id } });
      expect(transaction.status).toBe('HELD_IN_ESCROW'); // untouched
      const updatedFreelancer = await prisma.user.findUniqueOrThrow({ where: { id: freelancer.id } });
      expect(updatedFreelancer.earningsBalance).toBe(before); // not credited
    });

    it('allows approval once the dispute is resolved (no longer OPEN)', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({ clientId: client.id, freelancerId: freelancer.id });

      await prisma.dispute.create({
        data: {
          gigId: gig.id,
          raisedById: client.id,
          reason: 'Work not delivered as agreed.',
          status: DisputeStatus.RESOLVED_PAYOUT,
        },
      });

      const result = await approveGigWork(gig.id);
      expect(result.transaction.status).toBe('RELEASED');
    });
  });

  describe('autoApproveOverdueGigs', () => {
    const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    it('auto-approves a normal overdue gig with no dispute', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        submittedAt: EIGHT_DAYS_AGO,
      });

      const result = await autoApproveOverdueGigs();
      expect(result.processedGigIds).toContain(gig.id);

      const updatedGig = await prisma.gig.findUniqueOrThrow({ where: { id: gig.id } });
      expect(updatedGig.status).toBe('completed');
    });

    it('does NOT auto-release escrow for an overdue gig with an OPEN dispute', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        submittedAt: EIGHT_DAYS_AGO,
      });
      await prisma.dispute.create({
        data: { gigId: gig.id, raisedById: client.id, reason: 'Fraud claim.', status: DisputeStatus.OPEN },
      });

      const result = await autoApproveOverdueGigs();
      expect(result.processedGigIds).not.toContain(gig.id);

      const updatedGig = await prisma.gig.findUniqueOrThrow({ where: { id: gig.id } });
      expect(updatedGig.status).toBe(GigStatus.submitted); // still stuck, correctly, pending admin review

      const transaction = await prisma.gigTransaction.findUniqueOrThrow({ where: { gigId: gig.id } });
      expect(transaction.status).toBe('HELD_IN_ESCROW');
    });

    it('ignores gigs not yet past the 7-day window', async () => {
      const client = await createUser();
      const freelancer = await createUnverifiedFreelancer();
      const { gig } = await setupHeldGigEscrow({
        clientId: client.id,
        freelancerId: freelancer.id,
        submittedAt: new Date(), // just submitted
      });

      const result = await autoApproveOverdueGigs();
      expect(result.processedGigIds).not.toContain(gig.id);
    });
  });
});
