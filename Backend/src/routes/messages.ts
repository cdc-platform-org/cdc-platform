import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved, requireNotBannedOrDeleted } from '../middleware/auth';
import { sendMessageSchema } from '../schemas/messageSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { requiresChatRequestConsent, hasAcceptedChatRequest } from '../services/chatConsentService';

const router = Router();
const participantSelect = { select: { id: true, name: true, role: true } };

// Broadcasts an in-app warning to both participants when a message gets
// blocked — the sender gets the specific reason; the recipient gets a
// lighter notice so they're not left wondering why nothing arrived, without
// exposing the blocked content to them.
async function notifyBothOfBlockedMessage(senderId: string, recipientId: string): Promise<void> {
  await prisma.notification
    .createMany({
      data: [
        {
          userId: senderId,
          title: '⚠️ შეტყობინება დაბლოკილია',
          message: 'თქვენი შეტყობინება არ გაიგზავნა — მასში აღმოჩენილია საკონტაქტო ინფორმაცია ან პლატფორმის გარეშე გადახდის ფრაზა, რაც ეწინააღმდეგება წესებს.',
          type: 'CHAT_POLICY_VIOLATION',
        },
        {
          userId: recipientId,
          title: 'ℹ️ შეტყობინება დაბლოკილია',
          message: 'ამ საუბარში ერთი შეტყობინება დაიბლოკა პლატფორმის წესების დარღვევის გამო.',
          type: 'CHAT_POLICY_VIOLATION',
        },
      ],
    })
    .catch(() => {});
}

// ============================================================
// SEND — POST /messages. Two independent, layered checks before a message
// is ever created:
//   1. Request-First consent gate (services/chatConsentService.ts) — only
//      blocks Student<->Student pairs with no accepted ChatRequest and no
//      prior conversation. Every other role combination skips this check
//      entirely.
//   2. Anti-offboarding content filter (sanitizeChatMessage) — applies to
//      EVERY message through this route regardless of role. A flagged
//      message is BLOCKED outright (never stored, unlike this route's
//      previous mask-and-still-send behavior — see the Message model's own
//      comment in schema.prisma), logged to ChatFlag for /admin/chat-
//      moderation, and both participants get an in-app warning.
// ============================================================
router.post('/', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = sendMessageSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { recipientId, content } = result.data;

  if (recipientId === req.user!.id) {
    return res.status(400).json({ message: 'You cannot message yourself.' });
  }
  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) {
    return res.status(404).json({ message: 'Recipient not found.' });
  }

  if (await requiresChatRequestConsent(req.user!.id, recipientId)) {
    if (!(await hasAcceptedChatRequest(req.user!.id, recipientId))) {
      return res.status(403).json({
        requiresChatRequest: true,
        message: 'Send a chat request first — direct messages between students open only once the other person accepts.',
      });
    }
  }

  const { wasFiltered, severity } = sanitizeChatMessage(content);

  if (wasFiltered) {
    await prisma.chatFlag.create({
      data: {
        senderId: req.user!.id,
        recipientId,
        attemptedContent: content,
        detectedReason: 'Message contained off-platform contact info / payment phrasing (sanitizeChatMessage, evasion-aware).',
        severity,
      },
    });
    await notifyBothOfBlockedMessage(req.user!.id, recipientId);

    return res.status(422).json({
      blocked: true,
      severity,
      // Exact literal alert text — surfaced by ChatBox.tsx as a distinct,
      // more urgent banner than the general Georgian `message` below.
      alert: 'SECURITY ALERT: Offboarding attempt detected. Continued violations will result in account suspension.',
      message: '⚠️ პლატფორმის გარეთ კომუნიკაცია და გადახდა აკრძალულია საკომისიოს თავიდან არიდების მიზნით.',
    });
  }

  const message = await prisma.message.create({
    data: {
      senderId: req.user!.id,
      recipientId,
      content,
      wasFiltered: false,
    },
    include: { sender: participantSelect, recipient: participantSelect },
  });
  res.status(201).json({ data: message });
});

// requireApproved + requireNotBannedOrDeleted, matching this file's own
// POST / route just above — reading a full private DM thread is at least
// as sensitive as sending one, and a banned/self-deleted user's still-valid
// JWT must not keep working here just because this specific route never
// re-checked account standing.
router.get('/:otherUserId', authenticate, requireApproved, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const { otherUserId } = req.params;
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: req.user!.id, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: req.user!.id },
      ],
    },
    include: { sender: participantSelect, recipient: participantSelect },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: messages });
});

export default router;
