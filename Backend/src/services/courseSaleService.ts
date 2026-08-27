import { prisma } from '../lib/prisma';
import { getCommissionRate } from './platformFeeScheduleService';

// ============================================================
// Mentor course-sale payout — mirrors productSaleService.ts's
// completeProductPurchase (same atomic "am I first" claim, same
// commission/net split shape, same credit-earningsBalance-and-write-a-
// WalletEntry mechanics) for Course purchases.
//
// Rate (20% by default, flat — no verified/unverified split, unlike
// GIG/DIGITAL_PRODUCT, since a Mentor is already vetted through the
// MentorApplication approval gate before they can publish anything) is read
// from PlatformFeeSchedule's COURSE row (platformFeeScheduleService.ts),
// admin-editable at /admin/commissions.
//
// Called from both routes/payments.ts (BOG) and routes/stripePayments.ts
// (Stripe) — the free/promo-bypass branch and the webhook-completion branch
// in each — replacing what used to be four separate inline
// courseEnrollment.create/.upsert call sites with one shared, atomic
// implementation.
// ============================================================

export interface CourseSaleResult {
  // True only the one time this call actually created the enrollment —
  // false on every retry (a BOG/Stripe webhook redelivery, or the
  // /bog/status poll racing the same webhook) so callers know whether to
  // fire the one-time "you're enrolled" notification.
  isNewEnrollment: boolean;
  course: { id: string; title: string } | null;
}

// Safe to call more than once for the same (userId, courseId) pair, same
// reasoning as completeProductPurchase: a `createMany({ skipDuplicates: true })`
// claim against the userId_courseId unique constraint is the atomic "am I
// first" check — it either inserts and reports count 1 (this call wins and
// must run the payout), or silently reports count 0 via
// `INSERT ... ON CONFLICT DO NOTHING` (someone else already claimed it,
// back off without crediting twice). A plain findUnique-then-create would
// let two concurrent completions both read "not enrolled yet" and both
// credit the Mentor.
export async function completeCoursePurchase(params: {
  userId: string;
  courseId: string;
  amount: number;
}): Promise<CourseSaleResult> {
  return prisma.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: params.courseId },
      select: { id: true, title: true, instructorId: true },
    });

    const created = await tx.courseEnrollment.createMany({
      data: [{ userId: params.userId, courseId: params.courseId }],
      skipDuplicates: true,
    });
    const isNewEnrollment = created.count === 1;

    // Only a Mentor-authored course (instructorId set) pays out — an
    // admin-authored catalog course keeps the full amount with the
    // platform, same as an admin-catalog DigitalProduct.
    if (isNewEnrollment && course?.instructorId) {
      const commissionRate = await getCommissionRate('COURSE');
      const commissionAmount = Math.round(params.amount * commissionRate);
      const netAmount = params.amount - commissionAmount;

      await tx.courseEnrollment.update({
        where: { userId_courseId: { userId: params.userId, courseId: params.courseId } },
        data: { commissionRate, commissionAmount, netAmount },
      });

      const instructor = await tx.user.update({
        where: { id: course.instructorId },
        data: { earningsBalance: { increment: netAmount } },
      });
      await tx.walletEntry.create({
        data: {
          userId: instructor.id,
          type: 'COURSE_SALE_CREDIT',
          amount: netAmount,
          balanceAfter: instructor.earningsBalance,
        },
      });
    }

    return { isNewEnrollment, course: course ? { id: course.id, title: course.title } : null };
  });
}
