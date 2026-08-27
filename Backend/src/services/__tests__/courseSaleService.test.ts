import { prisma } from '../../lib/prisma';
import { completeCoursePurchase } from '../courseSaleService';
import { upsertCommissionPercentage } from '../platformFeeScheduleService';
import { createUser, createCourse } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('courseSaleService', () => {
  describe('completeCoursePurchase', () => {
    it('credits the Mentor instructor their net share exactly once, and is a no-op on a repeat call', async () => {
      await upsertCommissionPercentage('COURSE', 20, 'test');
      const buyer = await createUser();
      const instructor = await createUser({ role: 'Mentor' });
      const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });

      const first = await completeCoursePurchase({ userId: buyer.id, courseId: course.id, amount: 10000 });
      expect(first.isNewEnrollment).toBe(true);

      const enrollmentAfterFirst = await prisma.courseEnrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: buyer.id, courseId: course.id } },
      });
      expect(enrollmentAfterFirst.commissionAmount).toBe(2000);
      expect(enrollmentAfterFirst.netAmount).toBe(8000);

      const instructorAfterFirst = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
      expect(instructorAfterFirst.earningsBalance).toBe(8000);

      // A retry (a BOG/Stripe webhook redelivery racing the /bog/status poll
      // fallback) must not credit the instructor a second time.
      const second = await completeCoursePurchase({ userId: buyer.id, courseId: course.id, amount: 10000 });
      expect(second.isNewEnrollment).toBe(false);

      const instructorAfterSecond = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
      expect(instructorAfterSecond.earningsBalance).toBe(8000); // unchanged, not 16000

      const walletEntries = await prisma.walletEntry.findMany({ where: { userId: instructor.id, type: 'COURSE_SALE_CREDIT' } });
      expect(walletEntries).toHaveLength(1);
    });

    it('atomic claim: two concurrent completions of the same purchase credit the instructor exactly once', async () => {
      await upsertCommissionPercentage('COURSE', 20, 'test');
      const buyer = await createUser();
      const instructor = await createUser({ role: 'Mentor' });
      const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });

      // Simulates the BOG webhook and the frontend's /status poll fallback
      // racing each other for the exact same purchase, both completing it at
      // nearly the same time.
      const results = await Promise.all([
        completeCoursePurchase({ userId: buyer.id, courseId: course.id, amount: 10000 }),
        completeCoursePurchase({ userId: buyer.id, courseId: course.id, amount: 10000 }),
      ]);
      expect(results.filter((r) => r.isNewEnrollment)).toHaveLength(1);

      const instructorAfter = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
      expect(instructorAfter.earningsBalance).toBe(8000); // credited once, not 16000

      const walletEntries = await prisma.walletEntry.findMany({ where: { userId: instructor.id, type: 'COURSE_SALE_CREDIT' } });
      expect(walletEntries).toHaveLength(1);
    });

    it('admin-authored courses (no instructorId) keep the full amount and credit nobody', async () => {
      const buyer = await createUser();
      const course = await createCourse({ originalPrice: 5000 });

      const result = await completeCoursePurchase({ userId: buyer.id, courseId: course.id, amount: 5000 });
      expect(result.isNewEnrollment).toBe(true);

      const enrollment = await prisma.courseEnrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId: buyer.id, courseId: course.id } },
      });
      expect(enrollment.commissionAmount).toBeNull();
      expect(enrollment.netAmount).toBeNull();
    });

    it('a 100%-off promo (amount: 0) still enrolls and records a zero-value split, matching the free-DigitalProduct-claim convention', async () => {
      await upsertCommissionPercentage('COURSE', 20, 'test');
      const buyer = await createUser();
      const instructor = await createUser({ role: 'Mentor' });
      const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });

      const result = await completeCoursePurchase({ userId: buyer.id, courseId: course.id, amount: 0 });
      expect(result.isNewEnrollment).toBe(true);

      const instructorAfter = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
      expect(instructorAfter.earningsBalance).toBe(0);
    });
  });
});
