import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { reserveLearningCheckout, LearningCheckoutError } from './learningCheckoutService';
import { sendLiveTrainingEnrollmentEmail } from './emailService';
import { sendRegistrationStatusWhatsApp, formatWhatsAppDate } from './whatsappService';
import { resolveNotificationLocale } from '../utils/notificationLocale';

export class LiveTrainingInviteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export async function createInvite(liveTrainingId: string, input: { email?: string | null; maxRedemptions: number; expiresAt?: Date | null }, createdById: string) {
  const training = await prisma.liveTraining.findUnique({ where: { id: liveTrainingId }, select: { id: true } });
  if (!training) throw new LiveTrainingInviteError(404, 'Live training not found.');
  return prisma.liveTrainingInvite.create({
    data: {
      liveTrainingId, token: generateInviteToken(),
      email: input.email ? input.email.toLowerCase() : null,
      maxRedemptions: input.maxRedemptions, expiresAt: input.expiresAt ?? null, createdById,
    },
  });
}

export async function listInvites(liveTrainingId: string) {
  return prisma.liveTrainingInvite.findMany({ where: { liveTrainingId }, orderBy: { createdAt: 'desc' } });
}

export async function revokeInvite(id: string) {
  const invite = await prisma.liveTrainingInvite.findUnique({ where: { id } });
  if (!invite) throw new LiveTrainingInviteError(404, 'Invite not found.');
  if (invite.revokedAt) return invite;
  return prisma.liveTrainingInvite.update({ where: { id }, data: { revokedAt: new Date() } });
}

// The security-critical path: a QR/link invite may fast-track a FREE
// training's registration, but must never itself create a paid seat.
// reserveLearningCheckout is the SAME function routes/liveTrainings.ts's
// self-serve POST /:id/enroll calls, called here the identical way (no
// `gateway`) — its own guard ("!params.gateway && training.price > 0 ->
// throw") is what actually enforces this, so the protection lives in
// exactly one place rather than being re-implemented (and potentially
// drifting) here.
export async function redeemInvite(token: string, user: { id: string; email: string; name: string; phone: string | null }, locale?: string) {
  const invite = await prisma.liveTrainingInvite.findUnique({ where: { token }, include: { liveTraining: true } });
  if (!invite) throw new LiveTrainingInviteError(404, 'This invite link is invalid.');
  if (invite.revokedAt) throw new LiveTrainingInviteError(410, 'This invite has been revoked.');
  if (invite.expiresAt && invite.expiresAt < new Date()) throw new LiveTrainingInviteError(410, 'This invite has expired.');
  if (invite.redemptionCount >= invite.maxRedemptions) throw new LiveTrainingInviteError(410, 'This invite has already been used.');
  if (invite.email && invite.email !== user.email.toLowerCase()) throw new LiveTrainingInviteError(403, 'This invite was issued to a different email address.');

  const alreadyRedeemedByThisUser = await prisma.liveTrainingInviteRedemption.findUnique({
    where: { inviteId_userId: { inviteId: invite.id, userId: user.id } },
  });

  let enrollment;
  try {
    enrollment = await reserveLearningCheckout(
      { userId: user.id, purpose: 'LIVE_TRAINING', referenceId: invite.liveTrainingId, amount: 0 },
      (tx) => tx.liveTrainingEnrollment.upsert({
        where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: invite.liveTrainingId } },
        create: { userId: user.id, liveTrainingId: invite.liveTrainingId },
        update: { status: 'ACTIVE', enrolledAt: new Date(), completedAt: null },
      })
    );
  } catch (err) {
    // "Already enrolled" is not a redemption failure from the invite's own
    // point of view — the learner already has the seat this invite would
    // have granted. Let it through as a successful redemption instead of
    // surfacing a confusing error for someone re-opening their own QR link.
    if (err instanceof LearningCheckoutError && err.status === 400 && /already enrolled/i.test(err.message)) {
      enrollment = await prisma.liveTrainingEnrollment.findUniqueOrThrow({ where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: invite.liveTrainingId } } });
    } else if (err instanceof LearningCheckoutError) {
      throw new LiveTrainingInviteError(err.status, err.message);
    } else {
      throw err;
    }
  }

  if (!alreadyRedeemedByThisUser) {
    await prisma.$transaction([
      prisma.liveTrainingInviteRedemption.create({ data: { inviteId: invite.id, userId: user.id } }),
      prisma.liveTrainingInvite.update({ where: { id: invite.id }, data: { redemptionCount: { increment: 1 } } }),
    ]);

    const enrollLocale = resolveNotificationLocale(locale);
    sendLiveTrainingEnrollmentEmail({
      email: user.email, userName: user.name, courseTitle: invite.liveTraining.title,
      startDate: invite.liveTraining.startDate, meetLink: invite.liveTraining.meetingUrl, classroomLink: invite.liveTraining.classroomUrl,
      locale: enrollLocale,
    }).catch((err) => console.error('[liveTrainingInviteService] sendLiveTrainingEnrollmentEmail failed:', err));
    if (user.phone) {
      sendRegistrationStatusWhatsApp({
        phone: user.phone, firstName: user.name, itemTitle: invite.liveTraining.title,
        scheduleText: formatWhatsAppDate(invite.liveTraining.startDate, enrollLocale), paymentStatus: 'PAID', locale: enrollLocale,
        accessNote: invite.liveTraining.meetingUrl || invite.liveTraining.classroomUrl
          ? [invite.liveTraining.meetingUrl, invite.liveTraining.classroomUrl].filter(Boolean).join(' | ') : undefined,
      }).catch((err) => console.error('[liveTrainingInviteService] sendRegistrationStatusWhatsApp failed:', err));
    }
  }

  return { enrollment, liveTraining: { id: invite.liveTraining.id, title: invite.liveTraining.title } };
}
