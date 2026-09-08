import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { sendLiveTrainingEnrollmentEmail } from './emailService';
import { sendRegistrationStatusWhatsApp, formatWhatsAppDate } from './whatsappService';
import { lockLearningTarget } from './learningCheckoutService';

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

// "Automatically grant Student role/badge on purchase" — deliberately NOT
// a role overwrite here either, same reasoning as
// courseEnrollmentNotification.ts's own AUDIT NOTE (access is already
// role-agnostic; every organic registration already defaults to Student
// now that register.tsx's role picker is gone; forcibly flipping an
// existing Client/Mentor's role on purchase would silently strip their own
// dashboard/capabilities, which nothing here asked for unambiguously).

export interface LiveTrainingSaleResult {
  // True only the first time this call actually activates the enrollment —
  // false on a retried webhook delivery — so callers know whether to treat
  // this as a fresh purchase (e.g. for future confirmation-email wiring).
  isNewEnrollment: boolean;
  liveTraining: { id: string; title: string; startDate: Date | null; meetingUrl: string | null; classroomUrl: string | null } | null;
}

export async function completeLiveTrainingPurchase(params: { userId: string; liveTrainingId: string }, transaction?: Prisma.TransactionClient): Promise<LiveTrainingSaleResult> {
  const fulfill = async (tx: Prisma.TransactionClient) => {
  await lockLearningTarget(tx, 'LIVE_TRAINING', params.liveTrainingId);
  const liveTraining = await tx.liveTraining.findUnique({
    where: { id: params.liveTrainingId },
    select: { id: true, title: true, startDate: true, meetingUrl: true, classroomUrl: true },
  });

  const before = await tx.liveTrainingEnrollment.findUnique({
    where: { userId_liveTrainingId: { userId: params.userId, liveTrainingId: params.liveTrainingId } },
  });
  const isNewEnrollment = !before || before.status === 'CANCELLED';

  if (isNewEnrollment) await tx.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: params.userId, liveTrainingId: params.liveTrainingId } },
    create: { userId: params.userId, liveTrainingId: params.liveTrainingId },
    update: { status: 'ACTIVE', enrolledAt: new Date() },
  });
  return { isNewEnrollment, liveTraining };
  };
  const result = transaction ? await fulfill(transaction) : await prisma.$transaction(fulfill);
  if (!transaction && result.isNewEnrollment && result.liveTraining) notifyLiveTrainingEnrollment(params.userId, result.liveTraining);
  return result;
}

export function notifyLiveTrainingEnrollment(userId: string, liveTraining: {
  id: string; title: string; startDate: Date | null; meetingUrl: string | null; classroomUrl: string | null;
}): void {

  // The confirmation email this comment used to just flag as a future TODO
  // — fired only for a genuinely fresh activation (isNewEnrollment), never
  // on a retried webhook delivery re-confirming the same payment.
  // Fire-and-forget: a Resend outage must never fail the payment webhook/
  // callback that got the user here.
  //
  // No `locale` param here (unlike routes/liveTrainings.ts's /register and
  // /enroll): this runs from a BOG/Stripe webhook or callback, with no
  // browser/request context for the student at all — neither payment
  // record stores the locale the checkout page was viewed in, and adding
  // that would mean a schema migration purely to thread one field through
  // a webhook, out of scope here. Defaults to Georgian, same as every
  // other untracked-locale case.
    prisma.user
      .findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } })
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
          sendRegistrationStatusWhatsApp({
            phone: user.phone,
            firstName: user.name,
            itemTitle: liveTraining.title,
            // No `locale` param available here either (see this function's
            // own comment) — defaults to Georgian, same as the email above.
            scheduleText: formatWhatsAppDate(liveTraining.startDate, 'ka'),
            paymentStatus: 'PAID',
            accessNote:
              liveTraining.meetingUrl || liveTraining.classroomUrl
                ? [liveTraining.meetingUrl, liveTraining.classroomUrl].filter(Boolean).join(' | ')
                : undefined,
          }).catch((err) => console.error('[liveTrainingSaleService] sendRegistrationStatusWhatsApp failed:', err));
        }
      })
      .catch((err) => console.error('[liveTrainingSaleService] enrollment-notification user lookup failed:', err));
}
