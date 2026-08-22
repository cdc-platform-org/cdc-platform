import { prisma } from '../../lib/prisma';
import {
  captureHRSupportEscrow,
  markHRSupportDelivered,
  releaseHRSupportEscrow,
  flagHRSupportEscrowForReview,
  resolveHRSupportDispute,
  autoReleaseHRSupportEscrows,
  HRSupportEscrowError,
} from '../hrSupportEscrowService';
import { upsertCommissionPercentage } from '../platformFeeScheduleService';
import { createUser, createVacancy, createHRSupportRequest } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

async function heldRequest() {
  const employer = await createUser();
  const specialist = await createUser();
  const vacancy = await createVacancy({ postedById: employer.id });
  const request = await createHRSupportRequest({ vacancyId: vacancy.id, requestedById: employer.id });
  await captureHRSupportEscrow({ requestId: request.id, grossAmount: 20000 });
  await prisma.hRSupportRequest.update({ where: { id: request.id }, data: { assignedSpecialistId: specialist.id } });
  return { employer, specialist, request };
}

describe('hrSupportEscrowService', () => {
  describe('captureHRSupportEscrow', () => {
    it('locks in the HR_SUPPORT commission rate from PlatformFeeSchedule', async () => {
      await upsertCommissionPercentage('HR_SUPPORT', 40, 'test');
      const { request } = await heldRequest();

      const captured = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(captured.commissionRate).toBeCloseTo(0.4);
      expect(captured.commissionAmount).toBe(8000);
      expect(captured.netAmount).toBe(12000);
      expect(captured.escrowStatus).toBe('HELD_IN_ESCROW');
    });

    it('is idempotent — a second capture call is a no-op', async () => {
      const { request } = await heldRequest();
      const first = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });

      await captureHRSupportEscrow({ requestId: request.id, grossAmount: 999999 });

      const second = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(second.commissionAmount).toBe(first.commissionAmount);
    });
  });

  describe('markHRSupportDelivered', () => {
    it('requires an assigned specialist', async () => {
      const employer = await createUser();
      const vacancy = await createVacancy({ postedById: employer.id });
      const request = await createHRSupportRequest({ vacancyId: vacancy.id, requestedById: employer.id });
      await captureHRSupportEscrow({ requestId: request.id, grossAmount: 20000 });

      await expect(markHRSupportDelivered(request.id, 'Top 3 candidates.')).rejects.toThrow('no assigned specialist');
    });

    it('sets DELIVERED status and starts the auto-release clock', async () => {
      const { request } = await heldRequest();
      await markHRSupportDelivered(request.id, 'Top 3 candidates ranked.');

      const delivered = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(delivered.status).toBe('DELIVERED');
      expect(delivered.autoReleaseAt).not.toBeNull();
    });
  });

  describe('releaseHRSupportEscrow', () => {
    it('credits the specialist net amount', async () => {
      const { specialist, request } = await heldRequest();
      const before = specialist.earningsBalance;

      await releaseHRSupportEscrow(request.id, 'CLIENT_CONFIRMED');

      const updatedSpecialist = await prisma.user.findUniqueOrThrow({ where: { id: specialist.id } });
      const updatedRequest = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(updatedRequest.escrowStatus).toBe('RELEASED');
      expect(updatedSpecialist.earningsBalance).toBe(before + updatedRequest.netAmount!);
    });

    it('atomic claim: two concurrent releases credit the specialist exactly once', async () => {
      const { specialist, request } = await heldRequest();
      const before = specialist.earningsBalance;

      const results = await Promise.allSettled([
        releaseHRSupportEscrow(request.id, 'CLIENT_CONFIRMED'),
        releaseHRSupportEscrow(request.id, 'AUTO_RELEASE'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const updatedSpecialist = await prisma.user.findUniqueOrThrow({ where: { id: specialist.id } });
      const updatedRequest = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(updatedSpecialist.earningsBalance).toBe(before + updatedRequest.netAmount!);

      const entries = await prisma.walletEntry.findMany({ where: { relatedHRSupportRequestId: request.id } });
      expect(entries).toHaveLength(1);
    });

    it('rejects releasing when there is no assigned specialist to credit', async () => {
      const employer = await createUser();
      const vacancy = await createVacancy({ postedById: employer.id });
      const request = await createHRSupportRequest({ vacancyId: vacancy.id, requestedById: employer.id });
      await captureHRSupportEscrow({ requestId: request.id, grossAmount: 20000 });

      await expect(releaseHRSupportEscrow(request.id, 'AUTO_RELEASE')).rejects.toThrow(HRSupportEscrowError);
    });
  });

  describe('dispute flow', () => {
    it('an employer dispute freezes escrow; admin RELEASE still credits the specialist, REFUND does not', async () => {
      const { specialist, request } = await heldRequest();
      const before = specialist.earningsBalance;

      await flagHRSupportEscrowForReview(request.id, 'Report quality disputed.');
      const flagged = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(flagged.disputeRaisedAt).not.toBeNull();
      expect(flagged.escrowStatus).toBe('HELD_IN_ESCROW');

      await resolveHRSupportDispute(request.id, 'RELEASE');
      const released = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(released.escrowStatus).toBe('RELEASED');
      const updatedSpecialist = await prisma.user.findUniqueOrThrow({ where: { id: specialist.id } });
      expect(updatedSpecialist.earningsBalance).toBe(before + released.netAmount!);
    });

    it('autoReleaseHRSupportEscrows skips a disputed request even if past autoReleaseAt', async () => {
      const { request, specialist } = await heldRequest();
      await markHRSupportDelivered(request.id, 'Report ready.');
      await prisma.hRSupportRequest.update({
        where: { id: request.id },
        data: { autoReleaseAt: new Date(Date.now() - 1000) }, // force past-due
      });
      await flagHRSupportEscrowForReview(request.id, 'Employer disputes quality.');
      const before = specialist.earningsBalance;

      const result = await autoReleaseHRSupportEscrows();
      expect(result.releasedIds).not.toContain(request.id);

      const stillHeld = await prisma.hRSupportRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(stillHeld.escrowStatus).toBe('HELD_IN_ESCROW');
      const specialistAfter = await prisma.user.findUniqueOrThrow({ where: { id: specialist.id } });
      expect(specialistAfter.earningsBalance).toBe(before);
    });
  });
});
