import crypto from 'crypto';
import { LiveTraining, LiveTrainingInvitePolicy } from '@prisma/client';
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

export async function createInvite(liveTrainingId: string, input: {
  email?: string | null; maxRedemptions: number; expiresAt?: Date | null; startsAt?: Date | null;
  policy?: LiveTrainingInvitePolicy; requiresApproval?: boolean;
}, createdById: string) {
  const training = await prisma.liveTraining.findUnique({ where: { id: liveTrainingId }, select: { id: true } });
  if (!training) throw new LiveTrainingInviteError(404, 'Live training not found.');
  return prisma.liveTrainingInvite.create({
    data: {
      liveTrainingId, token: generateInviteToken(),
      email: input.email ? input.email.toLowerCase() : null,
      maxRedemptions: input.maxRedemptions, expiresAt: input.expiresAt ?? null, startsAt: input.startsAt ?? null,
      // Omitted entirely (not `null`) when the admin didn't choose one, so
      // Prisma's own column default (PAYMENT_REQUIRED — see schema.prisma)
      // is what actually decides "safe by default", in exactly one place.
      ...(input.policy ? { policy: input.policy } : {}),
      requiresApproval: !!input.requiresApproval,
      createdById,
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

// Issues a fresh token on the same invite row (same policy, approval
// setting, redemption history and budget) — lets an admin invalidate a
// leaked/posted QR code or link without losing who already redeemed it.
export async function rotateInvite(id: string) {
  const invite = await prisma.liveTrainingInvite.findUnique({ where: { id } });
  if (!invite) throw new LiveTrainingInviteError(404, 'Invite not found.');
  return prisma.liveTrainingInvite.update({ where: { id }, data: { token: generateInviteToken() } });
}

export async function listInviteRequests(inviteId: string) {
  const rows = await prisma.liveTrainingInviteRedemption.findMany({
    where: { inviteId }, orderBy: { redeemedAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((row) => ({ userId: row.userId, status: row.status, user: row.user }));
}

// Shared by the immediate-redeem path (no approval required) and the
// admin-approval path below — the ONLY two places an invite may actually
// create/activate a seat, so the payment guard override and the
// enrollment-notification behavior can never drift between them.
async function grantInviteEnrollment(
  training: Pick<LiveTraining, 'id' | 'title' | 'startDate' | 'meetingUrl' | 'classroomUrl'>,
  user: { id: string; email: string; name: string; phone: string | null },
  allowFreeOnPaid: boolean,
  locale?: string
) {
  let enrollment;
  try {
    enrollment = await reserveLearningCheckout(
      { userId: user.id, purpose: 'LIVE_TRAINING', referenceId: training.id, amount: 0, allowFreeOnPaid },
      (tx) => tx.liveTrainingEnrollment.upsert({
        where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: training.id } },
        create: { userId: user.id, liveTrainingId: training.id },
        update: { status: 'ACTIVE', enrolledAt: new Date(), completedAt: null },
      })
    );
  } catch (err) {
    if (err instanceof LearningCheckoutError && err.status === 400 && /already enrolled/i.test(err.message)) {
      enrollment = await prisma.liveTrainingEnrollment.findUniqueOrThrow({ where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: training.id } } });
    } else if (err instanceof LearningCheckoutError) {
      throw new LiveTrainingInviteError(err.status, err.message);
    } else {
      throw err;
    }
  }

  const enrollLocale = resolveNotificationLocale(locale);
  sendLiveTrainingEnrollmentEmail({
    email: user.email, userName: user.name, courseTitle: training.title,
    startDate: training.startDate, meetLink: training.meetingUrl, classroomLink: training.classroomUrl,
    locale: enrollLocale,
  }).catch((err) => console.error('[liveTrainingInviteService] sendLiveTrainingEnrollmentEmail failed:', err));
  if (user.phone) {
    sendRegistrationStatusWhatsApp({
      phone: user.phone, firstName: user.name, itemTitle: training.title,
      scheduleText: formatWhatsAppDate(training.startDate, enrollLocale), paymentStatus: 'PAID', locale: enrollLocale,
      accessNote: training.meetingUrl || training.classroomUrl ? [training.meetingUrl, training.classroomUrl].filter(Boolean).join(' | ') : undefined,
    }).catch((err) => console.error('[liveTrainingInviteService] sendRegistrationStatusWhatsApp failed:', err));
  }
  return enrollment;
}

// An admin decision on a PENDING_APPROVAL request — see redeemInvite's own
// comment for why a `requiresApproval` invite never grants a seat on its own.
export async function reviewInviteRequest(inviteId: string, userId: string, decision: 'approve' | 'reject', locale?: string) {
  const redemption = await prisma.liveTrainingInviteRedemption.findUnique({ where: { inviteId_userId: { inviteId, userId } } });
  if (!redemption) throw new LiveTrainingInviteError(404, 'No request found for this user.');
  if (redemption.status !== 'PENDING_APPROVAL') throw new LiveTrainingInviteError(409, 'This request has already been reviewed.');

  if (decision === 'reject') {
    return prisma.liveTrainingInviteRedemption.update({ where: { inviteId_userId: { inviteId, userId } }, data: { status: 'REJECTED' } });
  }

  const invite = await prisma.liveTrainingInvite.findUniqueOrThrow({ where: { id: inviteId }, include: { liveTraining: true } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, phone: true } });
  if (!user) throw new LiveTrainingInviteError(404, 'This user no longer exists.');
  // A genuine LearningCheckoutError here (e.g. the training filled up while
  // the request was pending) must leave the request PENDING_APPROVAL, not
  // silently mark it ACTIVE — the admin can retry once seats free up, or
  // reject it instead.
  await grantInviteEnrollment(invite.liveTraining, user, invite.policy === 'FREE_ENROLLMENT', locale);
  return prisma.liveTrainingInviteRedemption.update({ where: { inviteId_userId: { inviteId, userId } }, data: { status: 'ACTIVE' } });
}

export type InviteRedemptionStatus = 'ACTIVE' | 'PENDING_APPROVAL' | 'REGISTRATION_ONLY' | 'PAYMENT_REQUIRED' | 'REJECTED';

// The security-critical path: a QR/link invite may fast-track a FREE
// training's registration, but must never itself create a paid seat unless
// an admin explicitly configured this invite as FREE_ENROLLMENT (a
// conscious override, same posture as manual enrollment — see
// grantInviteEnrollment/reserveLearningCheckout's allowFreeOnPaid). The
// default policy (PAYMENT_REQUIRED) and REGISTRATION_ONLY never call
// reserveLearningCheckout at all for a paid training, so there is no path
// through this function that can create a free seat on a paid training
// without that explicit admin configuration.
export async function redeemInvite(token: string, user: { id: string; email: string; name: string; phone: string | null }, locale?: string): Promise<{ status: InviteRedemptionStatus; liveTraining: { id: string; title: string }; enrollment?: unknown }> {
  const invite = await prisma.liveTrainingInvite.findUnique({ where: { token }, include: { liveTraining: true } });
  if (!invite) throw new LiveTrainingInviteError(404, 'This invite link is invalid.');
  if (invite.revokedAt) throw new LiveTrainingInviteError(410, 'This invite has been revoked.');
  if (invite.startsAt && invite.startsAt > new Date()) throw new LiveTrainingInviteError(403, 'This invite is not active yet.');
  if (invite.expiresAt && invite.expiresAt < new Date()) throw new LiveTrainingInviteError(410, 'This invite has expired.');
  if (invite.email && invite.email !== user.email.toLowerCase()) throw new LiveTrainingInviteError(403, 'This invite was issued to a different email address.');

  const liveTraining = { id: invite.liveTraining.id, title: invite.liveTraining.title };

  // A returning visitor (already redeemed, in any resulting status) replays
  // their own outcome — never re-checked against maxRedemptions, which
  // could otherwise have filled up in the meantime from OTHER users and
  // incorrectly lock someone out of a seat they already hold or a decision
  // already made about their own request.
  const existing = await prisma.liveTrainingInviteRedemption.findUnique({ where: { inviteId_userId: { inviteId: invite.id, userId: user.id } } });
  if (existing) {
    if (existing.status === 'ACTIVE') {
      const enrollment = await prisma.liveTrainingEnrollment.findUnique({ where: { userId_liveTrainingId: { userId: user.id, liveTrainingId: invite.liveTrainingId } } });
      return { status: 'ACTIVE', liveTraining, enrollment };
    }
    return { status: existing.status, liveTraining };
  }

  if (invite.redemptionCount >= invite.maxRedemptions) throw new LiveTrainingInviteError(410, 'This invite has already been used.');

  const isPaidTraining = !!invite.liveTraining.price && invite.liveTraining.price > 0;

  // Registration-only invites never create an enrollment or take a payment
  // — they just record interest and point the learner at the normal
  // registration flow (see the Frontend invite page's `registered` state).
  if (invite.policy === 'REGISTRATION_ONLY') {
    await recordRedemption(invite.id, user.id, 'REGISTRATION_ONLY');
    return { status: 'REGISTRATION_ONLY', liveTraining };
  }

  // Default/explicit PAYMENT_REQUIRED on an actually-paid training: no
  // redemption row is written at all (nothing was granted, so the invite's
  // redemption budget is untouched and the learner can complete a real
  // checkout and come back, or simply pay through the normal flow directly).
  if (invite.policy === 'PAYMENT_REQUIRED' && isPaidTraining) {
    return { status: 'PAYMENT_REQUIRED', liveTraining };
  }

  // From here the training is free, or an admin explicitly set
  // FREE_ENROLLMENT to waive payment on a paid one.
  if (invite.requiresApproval) {
    await recordRedemption(invite.id, user.id, 'PENDING_APPROVAL');
    return { status: 'PENDING_APPROVAL', liveTraining };
  }

  const enrollment = await grantInviteEnrollment(invite.liveTraining, user, invite.policy === 'FREE_ENROLLMENT', locale);
  await recordRedemption(invite.id, user.id, 'ACTIVE');
  return { status: 'ACTIVE', liveTraining, enrollment };
}

async function recordRedemption(inviteId: string, userId: string, status: 'ACTIVE' | 'PENDING_APPROVAL' | 'REGISTRATION_ONLY') {
  await prisma.$transaction([
    prisma.liveTrainingInviteRedemption.create({ data: { inviteId, userId, status } }),
    prisma.liveTrainingInvite.update({ where: { id: inviteId }, data: { redemptionCount: { increment: 1 } } }),
  ]);
}
