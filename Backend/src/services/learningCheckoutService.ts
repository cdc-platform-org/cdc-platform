import { Prisma, PromoCode } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { claimPromoRedemption } from './couponService';

type LearningPurpose = 'COURSE' | 'LIVE_TRAINING';

export class LearningCheckoutError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// A row lock coordinates BOG, Stripe, free enrollment and anonymous leads.
// No gateway/network request runs while this transaction holds the lock.
export async function lockLearningTarget(tx: Prisma.TransactionClient, purpose: LearningPurpose, id: string) {
  if (purpose === 'LIVE_TRAINING') {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${id} FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM courses WHERE id = ${id} FOR UPDATE`;
  }
}

function pendingSeatWhere(purpose: LearningPurpose, referenceId: string, excludeUserId?: string) {
  return {
    purpose, referenceId, status: 'PENDING' as const,
    ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
  };
}

export async function countPendingLearningSeats(
  tx: Prisma.TransactionClient, purpose: LearningPurpose, referenceId: string, excludeUserId?: string
): Promise<number> {
  const where = pendingSeatWhere(purpose, referenceId, excludeUserId);
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  // Real gateway orders reserve their seat until reconciliation confirms a
  // terminal result. An old failed-to-create placeholder holds no seat.
  const bog = await tx.bogPayment.findMany({
    where: { ...where, OR: [{ bogOrderId: { not: { startsWith: 'pending-' } } }, { createdAt: { gte: cutoff } }] },
    select: { userId: true },
  });
  const stripe = await tx.stripePayment.findMany({
    where: { ...where, OR: [{ stripeSessionId: { not: { startsWith: 'pending-' } } }, { createdAt: { gte: cutoff } }] },
    select: { userId: true },
  });
  const enrolled = purpose === 'LIVE_TRAINING'
    ? await tx.liveTrainingEnrollment.findMany({ where: { liveTrainingId: referenceId, status: { not: 'CANCELLED' } }, select: { userId: true } })
    : await tx.courseEnrollment.findMany({ where: { courseId: referenceId }, select: { userId: true } });
  const enrolledIds = new Set(enrolled.map((row) => row.userId));
  return new Set([...bog, ...stripe].map((row) => row.userId).filter((id) => !enrolledIds.has(id))).size;
}

export async function reserveLearningCheckout<T>(params: {
  userId: string;
  purpose: LearningPurpose;
  referenceId: string;
  gateway?: 'BOG' | 'STRIPE';
  amount: number;
  promo?: PromoCode | null;
}, create: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lockLearningTarget(tx, params.purpose, params.referenceId);
    let used: number;
    let capacity: number | null;
    if (params.purpose === 'LIVE_TRAINING') {
      const training = await tx.liveTraining.findUnique({
        where: { id: params.referenceId },
        include: { _count: { select: { leads: true, enrollments: { where: { status: { not: 'CANCELLED' } } } } } },
      });
      if (!training?.published) throw new LearningCheckoutError(404, 'Live training not found.');
      const enrollment = await tx.liveTrainingEnrollment.findUnique({
        where: { userId_liveTrainingId: { userId: params.userId, liveTrainingId: params.referenceId } },
      });
      if (enrollment && enrollment.status !== 'CANCELLED') throw new LearningCheckoutError(400, 'You are already enrolled in this training.');
      used = training._count.leads + training._count.enrollments;
      capacity = training.maxCapacity;
    } else {
      const course = await tx.course.findUnique({ where: { id: params.referenceId } });
      if (course?.status !== 'PUBLISHED') throw new LearningCheckoutError(404, 'Course not found.');
      if (await tx.courseEnrollment.findUnique({ where: { userId_courseId: { userId: params.userId, courseId: params.referenceId } } })) {
        throw new LearningCheckoutError(400, 'You are already enrolled in this course.');
      }
      used = await tx.courseEnrollment.count({ where: { courseId: params.referenceId } });
      capacity = course.maxCapacity;
    }

    const where = { userId: params.userId, purpose: params.purpose, referenceId: params.referenceId, status: 'PENDING' as const, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } };
    const bog = await tx.bogPayment.findFirst({ where, orderBy: { createdAt: 'desc' } });
    const stripe = await tx.stripePayment.findFirst({ where, orderBy: { createdAt: 'desc' } });
    const samePromo = (promoId: string | null) => promoId === (params.promo?.id ?? null);
    // A parallel request may arrive before the first redirect was saved.
    // Reject it instead of creating another payable order or spending a promo twice.
    if ((bog && (params.gateway !== 'BOG' || (bog.amount === params.amount && samePromo(bog.promoCodeId)))) ||
        (stripe && (params.gateway !== 'STRIPE' || (stripe.amountGel === params.amount && samePromo(stripe.promoCodeId))))) {
      throw new LearningCheckoutError(409, 'A checkout is already in progress. Please retry in a moment.');
    }
    if (capacity != null && used + await countPendingLearningSeats(tx, params.purpose, params.referenceId, params.userId) >= capacity) {
      throw new LearningCheckoutError(409, params.purpose === 'COURSE' ? 'This course is full.' : 'This training is fully booked.');
    }
    if (params.promo) await claimPromoRedemption(params.promo, tx);
    return create(tx);
  });
}
