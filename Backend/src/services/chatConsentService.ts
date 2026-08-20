import { prisma } from '../lib/prisma';

// ============================================================
// Request-First consent gate for direct messaging — scoped specifically to
// Student<->Student pairs (routes/messages.ts's POST / is the enforcement
// point; routes/chatRequests.ts is how a request actually gets created/
// accepted/rejected). Every other role combination (a Client, Mentor, or
// SuperAdmin on either side) keeps the platform's original open-messaging
// behavior — those relationships already have their own established
// channel (a gig/vacancy, a mentorship booking, admin support), so gating
// them here would just add friction to something that isn't the
// circumvention risk this feature targets.
// ============================================================

// True only when BOTH users are Student role AND no Message has ever
// passed between them — an existing thread (even predating this feature)
// is treated as already-consented, since the point is to stop an
// UNSOLICITED first contact, not re-gate an ongoing conversation.
export async function requiresChatRequestConsent(userAId: string, userBId: string): Promise<boolean> {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({ where: { id: userAId }, select: { role: true } }),
    prisma.user.findUnique({ where: { id: userBId }, select: { role: true } }),
  ]);
  if (userA?.role !== 'Student' || userB?.role !== 'Student') return false;

  const priorMessage = await prisma.message.findFirst({
    where: {
      OR: [
        { senderId: userAId, recipientId: userBId },
        { senderId: userBId, recipientId: userAId },
      ],
    },
    select: { id: true },
  });
  return !priorMessage;
}

export async function hasAcceptedChatRequest(userAId: string, userBId: string): Promise<boolean> {
  const accepted = await prisma.chatRequest.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: userAId, recipientId: userBId },
        { senderId: userBId, recipientId: userAId },
      ],
    },
    select: { id: true },
  });
  return !!accepted;
}
