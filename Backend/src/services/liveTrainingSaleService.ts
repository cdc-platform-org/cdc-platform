import { prisma } from '../lib/prisma';

// ============================================================
// Fulfillment for a paid LiveTraining seat — mirrors courseSaleService.ts's
// completeCoursePurchase in shape (called from both routes/payments.ts's
// BOG callback and routes/stripePayments.ts's Stripe webhook, once
// terminal COMPLETED status is confirmed), but simpler: a LiveTraining has
// no instructor/commission split to pay out, so this only needs to flip
// the LiveTrainingEnrollment row ACTIVE. Uses upsert (not
// courseSaleService's createMany/skipDuplicates atomic-claim) since there
// is no payout to guard against double-crediting — a retried webhook
// delivery landing here twice is a harmless no-op either way, so a plain
// idempotent upsert is enough.
// ============================================================

export interface LiveTrainingSaleResult {
  // True only the first time this call actually activates the enrollment —
  // false on a retried webhook delivery — so callers know whether to treat
  // this as a fresh purchase (e.g. for future confirmation-email wiring).
  isNewEnrollment: boolean;
  liveTraining: { id: string; title: string } | null;
}

export async function completeLiveTrainingPurchase(params: { userId: string; liveTrainingId: string }): Promise<LiveTrainingSaleResult> {
  const liveTraining = await prisma.liveTraining.findUnique({
    where: { id: params.liveTrainingId },
    select: { id: true, title: true },
  });

  const before = await prisma.liveTrainingEnrollment.findUnique({
    where: { userId_liveTrainingId: { userId: params.userId, liveTrainingId: params.liveTrainingId } },
  });
  const isNewEnrollment = !before || before.status !== 'ACTIVE';

  await prisma.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: params.userId, liveTrainingId: params.liveTrainingId } },
    create: { userId: params.userId, liveTrainingId: params.liveTrainingId },
    update: { status: 'ACTIVE', enrolledAt: new Date() },
  });

  return { isNewEnrollment, liveTraining };
}
