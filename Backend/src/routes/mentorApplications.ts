import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { mentorApplicationCreateSchema } from '../schemas/mentorApplicationSchemas';

const router = Router();
router.use(authenticate, requireApproved);

// Self-serve "apply to become a mentor" — distinct from the older,
// still-supported admin-only promote path (adminMentorship.ts's
// POST /mentors/promote, for when an admin wants to grant Mentor status
// with no application on file). Approving an application via
// adminMentorApplications.ts's POST /:id/approve performs the exact same
// role update that path does.
router.post('/', async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true } });
  if (user?.role === 'Mentor') {
    return res.status(400).json({ message: 'You are already a Mentor.' });
  }

  const existingPending = await prisma.mentorApplication.findFirst({
    where: { userId: req.user!.id, status: 'PENDING' },
  });
  if (existingPending) {
    return res.status(400).json({ message: 'You already have a pending mentor application.' });
  }

  const result = mentorApplicationCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const application = await prisma.mentorApplication.create({
    data: { userId: req.user!.id, ...result.data },
  });
  res.status(201).json({ data: application });
});

// The applicant's own application history (most recent first) — lets the
// frontend show "pending review" / "rejected: <reason>, you may reapply" /
// nothing yet, without needing an admin-only list endpoint.
router.get('/me', async (req: Request, res: Response) => {
  const applications = await prisma.mentorApplication.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: applications });
});

export default router;
