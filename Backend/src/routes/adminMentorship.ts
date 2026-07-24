import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'));

const userSelect = { select: { id: true, name: true, email: true } };

// Gigs where the assigned freelancer clicked "Request CDC Mentor Help",
// still in progress (not yet completed/cancelled).
router.get('/queue', async (_req: Request, res: Response) => {
  const gigs = await prisma.gig.findMany({
    where: { mentorHelpRequestedAt: { not: null }, status: { in: ['assigned', 'submitted'] } },
    include: { postedBy: userSelect, assignedFreelancer: userSelect },
    orderBy: { mentorHelpRequestedAt: 'desc' },
  });

  // First-order flag, computed the same way as GET /gigs/:id.
  const withFirstOrder = await Promise.all(
    gigs.map(async (gig) => {
      const priorCompletedCount = gig.assignedFreelancerId
        ? await prisma.gig.count({
            where: { assignedFreelancerId: gig.assignedFreelancerId, status: 'completed', id: { not: gig.id } },
          })
        : 0;
      return { ...gig, isFirstOrder: priorCompletedCount === 0 };
    })
  );

  res.json({ data: withFirstOrder });
});

// Full submission draft, for a mentor/admin to review and guide the
// student before final delivery.
router.get('/gigs/:id', async (req: Request, res: Response) => {
  const gig = await prisma.gig.findUnique({
    where: { id: req.params.id },
    include: { postedBy: userSelect, assignedFreelancer: userSelect },
  });
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });
  res.json({ data: gig });
});

router.post('/gigs/:id/dismiss', async (req: Request, res: Response) => {
  const gig = await prisma.gig
    .update({ where: { id: req.params.id }, data: { mentorHelpRequestedAt: null } })
    .catch(() => null);
  if (!gig) return res.status(404).json({ message: 'Gig not found.' });
  res.json({ data: gig });
});

export default router;
