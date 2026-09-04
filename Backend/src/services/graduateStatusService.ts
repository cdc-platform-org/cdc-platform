import { prisma } from '../lib/prisma';
import { logAdminAction } from './auditLogService';
import { sendGraduateStatusEmail } from './emailService';

// Same congratulations copy in both the in-app Notification and the email —
// see forum.ts's own comment for what isVerifiedGraduate actually unlocks
// (unlimited monthly forum posts, i.e. the "CDC Employment Forum" access
// this message references).
const GRADUATE_NOTIFICATION_TITLE = 'გილოცავთ კურსდამთავრებას! 🎓';
const GRADUATE_NOTIFICATION_MESSAGE =
  'გილოცავთ კურსის წარმატებით დასრულებას! 🎓 თქვენ ავტომატურად მოგენიჭათ Graduate სტატუსი და გაგეხსნათ ულიმიტო წვდომა CDC-ის დასაქმების ფორუმზე!';

// Single shared "you're a CDC Graduate now" side effect — flips
// isVerifiedGraduate, audit-logs it (reusing the same action name
// courses.ts's exam-pass path already writes, distinguished by `trigger` in
// the metadata), and fires the in-app notification + congrats email. Called
// from adminLiveTrainings.ts when a LiveTraining/cohort enrollment is marked
// complete. Idempotent — a user who is already a graduate (e.g. from an
// earlier course exam pass) is left untouched and gets no duplicate
// notification/email.
export async function grantGraduateStatus(
  userId: string,
  performedById: string,
  trigger: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerifiedGraduate: true, email: true, name: true },
  });
  if (!user || user.isVerifiedGraduate) return;

  await prisma.user.update({ where: { id: userId }, data: { isVerifiedGraduate: true } });

  await logAdminAction({
    action: 'user.auto_verify_graduate',
    targetType: 'User',
    targetId: userId,
    performedById,
    metadata: { trigger, ...metadata },
  });

  await prisma.notification.create({
    data: {
      userId,
      title: GRADUATE_NOTIFICATION_TITLE,
      message: GRADUATE_NOTIFICATION_MESSAGE,
      type: 'GRADUATE_STATUS',
    },
  });

  await sendGraduateStatusEmail(user.email, user.name).catch((err) =>
    console.error(`[graduateStatusService] congrats email failed for ${userId}:`, err)
  );
}
