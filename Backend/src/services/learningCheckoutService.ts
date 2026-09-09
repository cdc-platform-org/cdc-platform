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
      if (!params.gateway && training.price && training.price > 0) {
        throw new LearningCheckoutError(400, 'This training requires payment. Please use the registration & payment option.');
      }
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

    const where = { userId: params.userId, purpose: params.purpose, referenceId: params.referenceId, status: 'PENDING' as const };
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const bog = await tx.bogPayment.findFirst({ where: { ...where, OR: [{ bogOrderId: { not: { startsWith: 'pending-' } } }, { createdAt: { gte: cutoff } }] } });
    const stripe = await tx.stripePayment.findFirst({ where: { ...where, OR: [{ stripeSessionId: { not: { startsWith: 'pending-' } } }, { createdAt: { gte: cutoff } }] } });
    // A pending gateway order remains payable even when the price, promo,
    // currency or selected gateway changes. Never issue a second payable
    // order until reconciliation confirms that the first one is terminal.
    if (bog || stripe) {
      throw new LearningCheckoutError(409, 'A checkout is already in progress. Please complete the existing checkout or wait for it to expire.');
    }
    if (capacity != null && used + await countPendingLearningSeats(tx, params.purpose, params.referenceId, params.userId) >= capacity) {
      throw new LearningCheckoutError(409, params.purpose === 'COURSE' ? 'This course is full.' : 'This training is fully booked.');
    }
    if (params.promo) await claimPromoRedemption(params.promo, tx);
    return create(tx);
  });
}
