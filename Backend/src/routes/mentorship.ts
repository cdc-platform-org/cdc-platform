import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { createMentorshipRequestSchema } from '../schemas/mentorshipSchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';

const router = Router();
router.use(authenticate);

// "დახმარება / მენტორობა" — the Dashboard button, CDC Verified Graduates
// only. General order/gig assistance, not tied to any specific gig (compare
// Gig.mentorHelpRequestedAt, which is scoped to one first-order gig).
router.post('/', requireApproved, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isVerifiedGraduate: true } });
  if (!user?.isVerifiedGraduate) {
    return res.status(403).json({ message: 'დახმარების მოთხოვნის გაგზავნა შესაძლებელია მხოლოდ CDC-ის კურსდამთავრებულებისთვის.' });
  }

  const result = createMentorshipRequestSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { sanitized: message } = sanitizeChatMessage(result.data.message);

  const request = await prisma.mentorshipRequest.create({
    data: { userId: req.user!.id, message },
  });
  res.status(201).json({ data: request });
});

router.get('/mine', async (req: Request, res: Response) => {
  const requests = await prisma.mentorshipRequest.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: requests });
});

export default router;
