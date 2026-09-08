import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { completeCoursePurchase } from './courseSaleService';
import { completeLiveTrainingPurchase, notifyLiveTrainingEnrollment } from './liveTrainingSaleService';
import { notifyCourseEnrollment } from './courseEnrollmentNotification';

// Commit the terminal payment state together with enrollment and payout.
// If fulfillment fails the payment remains PENDING so callback/poll retries
// can recover it. The row lock makes concurrent callbacks one completion.
export async function completeLearningPayment(
  gateway: 'BOG' | 'STRIPE', paymentId: string, rawEvent: unknown, paymentIntentId?: string | null
): Promise<boolean> {
  const result = await prisma.$transaction(async (tx) => {
    if (gateway === 'BOG') await tx.$queryRaw`SELECT id FROM bog_payments WHERE id = ${paymentId} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM stripe_payments WHERE id = ${paymentId} FOR UPDATE`;
    const payment = gateway === 'BOG'
      ? await tx.bogPayment.findUnique({ where: { id: paymentId } })
      : await tx.stripePayment.findUnique({ where: { id: paymentId } });
    if (!payment || (payment.purpose !== 'COURSE' && payment.purpose !== 'LIVE_TRAINING')) return { handled: false };
    if (payment.status !== 'PENDING') return { handled: true };
    const amount = 'amountGel' in payment ? payment.amountGel : payment.amount;
    const course = payment.purpose === 'COURSE'
      ? await completeCoursePurchase({ userId: payment.userId, courseId: payment.referenceId, amount }, tx)
      : null;
    const training = payment.purpose === 'LIVE_TRAINING'
      ? await completeLiveTrainingPurchase({ userId: payment.userId, liveTrainingId: payment.referenceId }, tx)
      : null;
    if (gateway === 'BOG') {
      await tx.bogPayment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', completedAt: new Date(), rawCallback: rawEvent as Prisma.InputJsonValue } });
    } else {
      await tx.stripePayment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', completedAt: new Date(), rawEvent: rawEvent as Prisma.InputJsonValue, stripePaymentIntentId: paymentIntentId } });
    }
    return { handled: true, userId: payment.userId, course, training };
  });
  if (result.userId && result.course?.isNewEnrollment && result.course.course) {
    await notifyCourseEnrollment(result.userId, result.course.course).catch((err) => console.error('[learning-payment] notification failed:', err));
  }
  if (result.userId && result.training?.isNewEnrollment && result.training.liveTraining) {
    notifyLiveTrainingEnrollment(result.userId, result.training.liveTraining);
  }
  return result.handled;
}
