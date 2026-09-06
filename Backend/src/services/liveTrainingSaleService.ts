import { prisma } from '../lib/prisma';
import { sendLiveTrainingEnrollmentEmail } from './emailService';
import { sendLiveTrainingEnrollmentWhatsApp } from './whatsappService';

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
    select: { id: true, title: true, startDate: true, meetingUrl: true, classroomUrl: true },
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

  // The confirmation email this comment used to just flag as a future TODO
  // — fired only for a genuinely fresh activation (isNewEnrollment), never
  // on a retried webhook delivery re-confirming the same payment.
  // Fire-and-forget: a Resend outage must never fail the payment webhook/
  // callback that got the user here.
  if (isNewEnrollment && liveTraining) {
    prisma.user
      .findUnique({ where: { id: params.userId }, select: { name: true, email: true, phone: true } })
      .then((user) => {
        if (!user) return;
        sendLiveTrainingEnrollmentEmail({
          email: user.email,
          userName: user.name,
          courseTitle: liveTraining.title,
          startDate: liveTraining.startDate,
          meetLink: liveTraining.meetingUrl,
          classroomLink: liveTraining.classroomUrl,
        }).catch((err) => console.error('[liveTrainingSaleService] sendLiveTrainingEnrollmentEmail failed:', err));
        if (user.phone) {
          sendLiveTrainingEnrollmentWhatsApp({
            phone: user.phone,
            userName: user.name,
            courseTitle: liveTraining.title,
            meetLink: liveTraining.meetingUrl,
            classroomLink: liveTraining.classroomUrl,
          }).catch((err) => console.error('[liveTrainingSaleService] sendLiveTrainingEnrollmentWhatsApp failed:', err));
        }
      })
      .catch((err) => console.error('[liveTrainingSaleService] enrollment-notification user lookup failed:', err));
  }

  return { isNewEnrollment, liveTraining };
}
