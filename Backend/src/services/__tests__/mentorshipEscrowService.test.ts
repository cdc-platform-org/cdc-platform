import { prisma } from '../../lib/prisma';
import {
  captureMentorshipEscrow,
  releaseMentorshipEscrow,
  flagMentorshipEscrowForReview,
  resolveMentorshipDispute,
  autoReleaseMentorshipEscrows,
  MentorshipEscrowError,
} from '../mentorshipEscrowService';
import { upsertCommissionPercentage } from '../platformFeeScheduleService';
import { createUser, createMentorshipBooking } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

async function heldBooking(overrides: { scheduledAt?: Date } = {}) {
  const mentor = await createUser();
  const student = await createUser();
  const booking = await createMentorshipBooking({ mentorId: mentor.id, studentId: student.id, ...overrides });
  await captureMentorshipEscrow({ bookingId: booking.id, grossAmount: 20000 });
  return { mentor, student, booking };
}

describe('mentorshipEscrowService', () => {
  describe('captureMentorshipEscrow', () => {
    it('locks in the MENTORSHIP commission rate from PlatformFeeSchedule', async () => {
      await upsertCommissionPercentage('MENTORSHIP', 20, 'test');
      const { booking } = await heldBooking();

      const captured = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(captured.commissionRate).toBeCloseTo(0.2);
      expect(captured.commissionAmount).toBe(4000);
      expect(captured.netAmount).toBe(16000);
      expect(captured.escrowStatus).toBe('HELD_IN_ESCROW');
    });

    it('is idempotent — a second capture call on the same booking is a no-op', async () => {
      const { booking } = await heldBooking();
      const first = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });

      await captureMentorshipEscrow({ bookingId: booking.id, grossAmount: 999999 }); // would blow up totals if it re-ran

      const second = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(second.commissionAmount).toBe(first.commissionAmount);
      expect(second.netAmount).toBe(first.netAmount);
    });
  });

  describe('releaseMentorshipEscrow', () => {
    it('credits the mentor and records the release trigger', async () => {
      const { mentor, booking } = await heldBooking();
      const before = mentor.earningsBalance;

      await releaseMentorshipEscrow(booking.id, 'STUDENT_CONFIRMED');

      const updatedMentor = await prisma.user.findUniqueOrThrow({ where: { id: mentor.id } });
      const updatedBooking = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updatedBooking.escrowStatus).toBe('RELEASED');
      expect(updatedBooking.releaseTrigger).toBe('STUDENT_CONFIRMED');
      expect(updatedMentor.earningsBalance).toBe(before + updatedBooking.netAmount!);
    });

    it('atomic claim: two concurrent releases credit the mentor exactly once', async () => {
      const { mentor, booking } = await heldBooking();
      const before = mentor.earningsBalance;

      const results = await Promise.allSettled([
        releaseMentorshipEscrow(booking.id, 'STUDENT_CONFIRMED'),
        releaseMentorshipEscrow(booking.id, 'AUTO_RELEASE'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

      const updatedMentor = await prisma.user.findUniqueOrThrow({ where: { id: mentor.id } });
      const updatedBooking = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(updatedMentor.earningsBalance).toBe(before + updatedBooking.netAmount!);

      const entries = await prisma.walletEntry.findMany({ where: { relatedMentorshipBookingId: booking.id } });
      expect(entries).toHaveLength(1);
    });

    it('rejects releasing a booking with nothing held in escrow', async () => {
      const mentor = await createUser();
      const student = await createUser();
      const booking = await createMentorshipBooking({ mentorId: mentor.id, studentId: student.id });
      // never captured — escrowStatus is still null
      await expect(releaseMentorshipEscrow(booking.id, 'AUTO_RELEASE')).rejects.toThrow(MentorshipEscrowError);
    });
  });

  describe('dispute flow', () => {
    it('flagging for review freezes the booking so a plain release is refused, and admin RELEASE still credits the mentor', async () => {
      const { mentor, booking } = await heldBooking();
      const before = mentor.earningsBalance;

      await flagMentorshipEscrowForReview(booking.id, 'Student says mentor no-showed.');
      const flagged = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(flagged.disputeRaisedAt).not.toBeNull();
      expect(flagged.escrowStatus).toBe('HELD_IN_ESCROW'); // flagging alone doesn't move money

      await resolveMentorshipDispute(booking.id, 'RELEASE');
      const resolved = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(resolved.escrowStatus).toBe('RELEASED');
      expect(resolved.disputeResolution).toBe('RELEASE');

      const updatedMentor = await prisma.user.findUniqueOrThrow({ where: { id: mentor.id } });
      expect(updatedMentor.earningsBalance).toBe(before + resolved.netAmount!);
    });

    it('admin REFUND on a disputed booking does not credit the mentor', async () => {
      const { mentor, booking } = await heldBooking();
      const before = mentor.earningsBalance;

      await flagMentorshipEscrowForReview(booking.id, 'Session never happened.');
      await resolveMentorshipDispute(booking.id, 'REFUND');

      const resolved = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(resolved.escrowStatus).toBe('REFUNDED');

      const updatedMentor = await prisma.user.findUniqueOrThrow({ where: { id: mentor.id } });
      expect(updatedMentor.earningsBalance).toBe(before);
    });

    it('autoReleaseMentorshipEscrows skips a disputed booking even if past its auto-release time', async () => {
      const mentor = await createUser();
      const student = await createUser();
      const pastScheduledAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // well past any grace window
      const booking = await createMentorshipBooking({ mentorId: mentor.id, studentId: student.id, scheduledAt: pastScheduledAt });
      await captureMentorshipEscrow({ bookingId: booking.id, grossAmount: 20000 });
      await flagMentorshipEscrowForReview(booking.id, 'Employer dispute.');

      const result = await autoReleaseMentorshipEscrows();
      expect(result.releasedIds).not.toContain(booking.id);

      const stillHeld = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(stillHeld.escrowStatus).toBe('HELD_IN_ESCROW');
    });

    it('autoReleaseMentorshipEscrows releases a non-disputed booking once past autoReleaseAt', async () => {
      const mentor = await createUser();
      const student = await createUser();
      const pastScheduledAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const booking = await createMentorshipBooking({ mentorId: mentor.id, studentId: student.id, scheduledAt: pastScheduledAt });
      await captureMentorshipEscrow({ bookingId: booking.id, grossAmount: 20000 });

      const result = await autoReleaseMentorshipEscrows();
      expect(result.releasedIds).toContain(booking.id);
    });
  });
});
