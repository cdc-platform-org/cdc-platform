import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { createChatRequestSchema } from '../schemas/chatSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';

const router = Router();
router.use(authenticate, requireApproved);

const participantSelect = { select: { id: true, name: true, role: true } };

// ============================================================
// CHAT REQUEST — Request-First consent flow for Student<->Student direct
// messaging (see services/chatConsentService.ts for exactly when this gate
// applies). PENDING -> ACCEPTED unlocks the pair for routes/messages.ts's
// POST /; PENDING -> REJECTED leaves them blocked, with no retry from the
// same sender (see the ChatRequest model's own comment in schema.prisma).
// ============================================================

router.post('/', async (req: Request, res: Response) => {
  const result = createChatRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { recipientId, introMessage } = result.data;

  if (recipientId === req.user!.id) {
    return res.status(400).json({ message: 'You cannot send a chat request to yourself.' });
  }
  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, isBanned: true } });
  if (!recipient) return res.status(404).json({ message: 'User not found.' });
  if (recipient.isBanned) return res.status(400).json({ message: 'This user is not reachable.' });

  // An existing row in EITHER direction means this pair already has a
  // request on record — return it instead of creating a duplicate, rather
  // than relying solely on the DB's one-direction unique constraint (which
  // wouldn't catch the reverse direction).
  const existing = await prisma.chatRequest.findFirst({
    where: {
      OR: [
        { senderId: req.user!.id, recipientId },
        { senderId: recipientId, recipientId: req.user!.id },
      ],
    },
  });
  if (existing) {
    return res.status(200).json({ data: existing, alreadyExists: true });
  }

  const sanitizedIntro = introMessage ? sanitizeChatMessage(introMessage).sanitized : null;

  let chatRequest;
  try {
    chatRequest = await prisma.chatRequest.create({
      data: { senderId: req.user!.id, recipientId, introMessage: sanitizedIntro },
    });
  } catch (err: any) {
    // The findFirst check above is not atomic with this create — a
    // concurrent duplicate request for the exact same (senderId,
    // recipientId) direction (@@unique in schema.prisma) can race past it.
    // Without this catch, the loser's P2002 reached the generic error
    // handler and returned an opaque 500 instead of the same clean
    // "already exists" response the check above was meant to guarantee.
    if (err.code === 'P2002') {
      const existingRow = await prisma.chatRequest.findFirst({
        where: {
          OR: [
            { senderId: req.user!.id, recipientId },
            { senderId: recipientId, recipientId: req.user!.id },
          ],
        },
      });
      if (existingRow) return res.status(200).json({ data: existingRow, alreadyExists: true });
    }
    throw err;
  }

  await prisma.notification.create({
    data: {
      userId: recipientId,
      title: '💬 ახალი ჩატის მოთხოვნა',
      message: 'ვინმემ მოგწერათ საუბრის მოთხოვნა — გადადით შეტყობინებებში პასუხის გასაცემად.',
      type: 'CHAT_REQUEST',
    },
  }).catch(() => {});

  res.status(201).json({ data: chatRequest });
});

// Every request awaiting MY decision.
router.get('/incoming', async (req: Request, res: Response) => {
  const requests = await prisma.chatRequest.findMany({
    where: { recipientId: req.user!.id, status: 'PENDING' },
    include: { sender: participantSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

// Requests I sent that are still awaiting a decision — lets the sender's
// own UI show "Request sent, waiting for a response" instead of a dead end.
router.get('/sent', async (req: Request, res: Response) => {
  const requests = await prisma.chatRequest.findMany({
    where: { senderId: req.user!.id, status: 'PENDING' },
    include: { recipient: participantSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

// Whatever the current state is between me and one other user — the
// Frontend calls this before rendering the chat page to decide whether to
// show a live ChatBox, a "waiting for acceptance" screen, or a "send a
// request" prompt. `null` means no request exists yet either direction.
router.get('/status/:otherUserId', async (req: Request, res: Response) => {
  const { otherUserId } = req.params;
  const chatRequest = await prisma.chatRequest.findFirst({
    where: {
      OR: [
        { senderId: req.user!.id, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: req.user!.id },
      ],
    },
    include: { sender: participantSelect, recipient: participantSelect },
  });
  res.json({ data: chatRequest });
});

router.post('/:id/accept', async (req: Request, res: Response) => {
  const chatRequest = await prisma.chatRequest.findUnique({ where: { id: req.params.id } });
  if (!chatRequest) return res.status(404).json({ message: 'Chat request not found.' });
  if (chatRequest.recipientId !== req.user!.id) {
    return res.status(403).json({ message: 'Only the recipient can accept this request.' });
  }
  if (chatRequest.status !== 'PENDING') {
    return res.status(400).json({ message: 'This request has already been decided.' });
  }

  const updated = await prisma.chatRequest.update({
    where: { id: chatRequest.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });

  await prisma.notification.create({
    data: {
      userId: chatRequest.senderId,
      title: '✅ ჩატის მოთხოვნა მიღებულია',
      message: 'თქვენი ჩატის მოთხოვნა მიღებულია — შეგიძლიათ დაიწყოთ საუბარი.',
      type: 'CHAT_REQUEST',
    },
  }).catch(() => {});

  res.json({ data: updated });
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const chatRequest = await prisma.chatRequest.findUnique({ where: { id: req.params.id } });
  if (!chatRequest) return res.status(404).json({ message: 'Chat request not found.' });
  if (chatRequest.recipientId !== req.user!.id) {
    return res.status(403).json({ message: 'Only the recipient can decline this request.' });
  }
  if (chatRequest.status !== 'PENDING') {
    return res.status(400).json({ message: 'This request has already been decided.' });
  }

  const updated = await prisma.chatRequest.update({
    where: { id: chatRequest.id },
    data: { status: 'REJECTED', respondedAt: new Date() },
  });

  res.json({ data: updated });
});

export default router;
