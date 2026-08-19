import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { optionalAuthenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { liveTrainingRegisterSchema } from '../schemas/liveTrainingSchemas';

const router = Router();

// Anonymous prospective trainees — same budget as StudioInquiry's, generous
// enough for a real visitor retrying a typo, tight enough to blunt a
// scripted spam flood.
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registrations submitted. Please try again later.',
});

// Only a logged-in SUPER_ADMIN/MANAGER sees an unpublished (draft) training
// — same posture as routes/blog.ts/routes/tutorials.ts's canViewDrafts.
async function canViewDrafts(req: Request): Promise<boolean> {
  if (!req.user) return false;
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { adminRole: true } });
  return user?.adminRole === 'SUPER_ADMIN' || user?.adminRole === 'MANAGER';
}

// registeredCount is always the live lead count (via _count), never a
// stored counter — a training only ever has a handful of registrations, so
// counting on every read is cheap and can't drift out of sync the way a
// manually-maintained counter could.
function withCapacity<T extends { minCapacity: number; maxCapacity: number; _count: { leads: number } }>(training: T) {
  const { _count, ...rest } = training;
  const registeredCount = _count.leads;
  return {
    ...rest,
    registeredCount,
    seatsRemaining: Math.max(0, training.maxCapacity - registeredCount),
    isFull: registeredCount >= training.maxCapacity,
    minThresholdMet: registeredCount >= training.minCapacity,
  };
}

router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const { category } = req.query;
  const includeDrafts = await canViewDrafts(req);
  const trainings = await prisma.liveTraining.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(includeDrafts ? {} : { published: true }),
    },
    include: { _count: { select: { leads: true } } },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({ data: trainings.map(withCapacity) });
});

router.get('/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const includeDrafts = await canViewDrafts(req);
  const training = await prisma.liveTraining.findFirst({
    where: { id: req.params.id, ...(includeDrafts ? {} : { published: true }) },
    include: { _count: { select: { leads: true } } },
  });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  res.json({ data: withCapacity(training) });
});

// Broadcasts to every admin-team member — same pattern as blogAgentService's
// notifyAdmins — so whoever checks the leads list first sees it, rather than
// one fixed recipient.
async function notifyAdminsOfNewLead(trainingTitle: string, leadName: string): Promise<void> {
  const admins = await prisma.user.findMany({ where: { adminRole: { not: null } }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      title: 'ახალი რეგისტრაცია ტრენინგზე',
      message: `${leadName} დარეგისტრირდა „${trainingTitle}"-ზე.`,
      type: 'LIVE_TRAINING',
    })),
  });
}

router.post('/:id/register', registerRateLimit, async (req: Request, res: Response) => {
  const result = liveTrainingRegisterSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const training = await prisma.liveTraining.findFirst({
    where: { id: req.params.id, published: true },
    include: { _count: { select: { leads: true } } },
  });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  if (training._count.leads >= training.maxCapacity) {
    return res.status(409).json({ message: 'This training is fully booked.' });
  }

  const lead = await prisma.liveTrainingLead.create({
    data: { liveTrainingId: training.id, ...result.data },
  });

  notifyAdminsOfNewLead(training.title, lead.name).catch((err) =>
    console.error('[liveTrainings] notifyAdminsOfNewLead failed:', err)
  );

  res.status(201).json({ data: { id: lead.id } });
});

export default router;
