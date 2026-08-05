import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { mentorAvailabilityRuleSchema, mentorProfileSchema } from '../schemas/adminSchemas';

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

// General "დახმარება / მენტორობა" requests from the Dashboard button — not
// tied to any specific gig, see MentorshipRequest's schema comment.
router.get('/requests', async (_req: Request, res: Response) => {
  const requests = await prisma.mentorshipRequest.findMany({
    where: { status: 'OPEN' },
    include: { user: userSelect },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: requests });
});

router.post('/requests/:id/resolve', async (req: Request, res: Response) => {
  const request = await prisma.mentorshipRequest
    .update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: req.user!.id },
    })
    .catch(() => null);
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  res.json({ data: request });
});

// ============================================================
// MENTOR AVAILABILITY & CALENDAR BOOKINGS — recurring weekly rules an admin
// sets per mentor (e.g. "Tuesdays 18:00-22:00"), enforced server-side at
// checkout by mentorAvailabilityService.assertSlotAvailable(). Distinct from
// the free-help-request queue above.
// ============================================================
router.get('/mentors', async (_req: Request, res: Response) => {
  const mentors = await prisma.user.findMany({
    where: { role: 'Mentor' },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      bio: true,
      mentorTitle: true,
      mentorHourlyRate: true,
      mentorSkills: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json({ data: mentors });
});

router.put('/mentors/:mentorId/profile', async (req: Request, res: Response) => {
  const mentor = await prisma.user.findUnique({ where: { id: req.params.mentorId } });
  if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });

  const result = mentorProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const updated = await prisma.user.update({
    where: { id: mentor.id },
    data: result.data,
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      bio: true,
      mentorTitle: true,
      mentorHourlyRate: true,
      mentorSkills: true,
    },
  });
  res.json({ data: updated });
});

router.get('/mentors/:mentorId/availability', async (req: Request, res: Response) => {
  const rules = await prisma.mentorAvailabilityRule.findMany({
    where: { mentorId: req.params.mentorId },
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
  res.json({ data: rules });
});

router.post('/mentors/:mentorId/availability', async (req: Request, res: Response) => {
  const mentor = await prisma.user.findUnique({ where: { id: req.params.mentorId } });
  if (!mentor || mentor.role !== 'Mentor') return res.status(404).json({ message: 'Mentor not found.' });

  const result = mentorAvailabilityRuleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const rule = await prisma.mentorAvailabilityRule.create({
    data: { mentorId: mentor.id, ...result.data },
  });
  res.status(201).json({ data: rule });
});

router.put('/availability/:ruleId', async (req: Request, res: Response) => {
  const result = mentorAvailabilityRuleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const rule = await prisma.mentorAvailabilityRule
    .update({ where: { id: req.params.ruleId }, data: result.data })
    .catch(() => null);
  if (!rule) return res.status(404).json({ message: 'Availability rule not found.' });
  res.json({ data: rule });
});

router.delete('/availability/:ruleId', async (req: Request, res: Response) => {
  await prisma.mentorAvailabilityRule.delete({ where: { id: req.params.ruleId } }).catch(() => null);
  res.status(204).send();
});

export default router;
