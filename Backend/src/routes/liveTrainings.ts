import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
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

// registeredCount is always the live lead + active-enrollment count (via
// _count), never a stored counter — a training only ever has a handful of
// registrations, so counting on every read is cheap and can't drift out of
// sync the way a manually-maintained counter could. Leads and enrollments
// are two independent registration paths (anonymous phone callback vs.
// authenticated self-serve, see LiveTrainingEnrollment's own comment) that
// both consume real seats, so capacity has to account for both.
const enrollmentCountSelect = { where: { status: { not: 'CANCELLED' as const } } };

function withCapacity<T extends { minCapacity: number; maxCapacity: number; _count: { leads: number; enrollments: number } }>(training: T) {
  const { _count, ...rest } = training;
  const registeredCount = _count.leads + _count.enrollments;
  return {
    ...rest,
    registeredCount,
    seatsRemaining: Math.max(0, training.maxCapacity - registeredCount),
    isFull: registeredCount >= training.maxCapacity,
    minThresholdMet: registeredCount >= training.minCapacity,
  };
}

// A meeting link is only ever worth showing shortly before the session
// starts through its end — never the moment it's pasted in, days early.
// endDate is optional (a single-instant session), so a fallback window
// covers that case rather than requiring every training to set one.
const MEETING_LINK_VISIBLE_BEFORE_MS = 2 * 60 * 60 * 1000; // 2h before startDate
const MEETING_LINK_VISIBLE_FALLBACK_MS = 6 * 60 * 60 * 1000; // used when endDate is unset

function isMeetingLinkVisible(training: { startDate: Date | null; endDate: Date | null }): boolean {
  if (!training.startDate) return false;
  const now = Date.now();
  const start = training.startDate.getTime();
  const end = training.endDate ? training.endDate.getTime() : start + MEETING_LINK_VISIBLE_FALLBACK_MS;
  return now >= start - MEETING_LINK_VISIBLE_BEFORE_MS && now <= end;
}

// Registered ahead of GET /:id below — "mine" would otherwise be swallowed
// by that route as if it were a training id.
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  const enrollments = await prisma.liveTrainingEnrollment.findMany({
    where: { userId: req.user!.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
    include: { liveTraining: true },
    orderBy: { liveTraining: { scheduledAt: 'asc' } },
  });

  res.json({
    data: enrollments.map((e) => ({
      enrollmentId: e.id,
      status: e.status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      liveTrainingId: e.liveTraining.id,
      title: e.liveTraining.title,
      titleEn: e.liveTraining.titleEn,
      scheduledAt: e.liveTraining.scheduledAt,
      startDate: e.liveTraining.startDate,
      endDate: e.liveTraining.endDate,
      meetingUrl: isMeetingLinkVisible(e.liveTraining) ? e.liveTraining.meetingUrl : null,
      classroomUrl: isMeetingLinkVisible(e.liveTraining) ? e.liveTraining.classroomUrl : null,
      recordingUrl: e.liveTraining.recordingUrl,
    })),
  });
});

router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const { category } = req.query;
  const includeDrafts = await canViewDrafts(req);
  const trainings = await prisma.liveTraining.findMany({
    where: {
      ...(category ? { category: String(category) } : {}),
      ...(includeDrafts ? {} : { published: true }),
    },
    include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({ data: trainings.map(withCapacity) });
});

router.get('/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const includeDrafts = await canViewDrafts(req);
  const training = await prisma.liveTraining.findFirst({
    where: { id: req.params.id, ...(includeDrafts ? {} : { published: true }) },
    include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
  });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  // Server-verified, not inferred from any client-side action — the
  // frontend used to only ever know "enrolled" from its own in-session
  // button click, so reloading this page (or a real payment landing via a
  // separate BOG/Stripe redirect round-trip) never showed the true state.
  // False for an anonymous visitor.
  let isEnrolled = false;
  if (req.user) {
    const enrollment = await prisma.liveTrainingEnrollment.findUnique({
      where: { userId_liveTrainingId: { userId: req.user.id, liveTrainingId: training.id } },
    });
    isEnrolled = enrollment?.status === 'ACTIVE' || enrollment?.status === 'COMPLETED';
  }

  res.json({ data: { ...withCapacity(training), isEnrolled } });
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
    include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
  });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  if (training._count.leads + training._count.enrollments >= training.maxCapacity) {
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

// ============================================================
// ENROLLMENTS — authenticated self-serve alternative to the anonymous
// lead-capture form above. Independent registration paths on purpose (see
// LiveTrainingEnrollment's own schema comment); both consume the same
// capacity pool. GET /mine is registered earlier, above GET /:id.
// ============================================================

// FREE trainings only — this used to grant an ACTIVE LiveTrainingEnrollment
// (and the frontend's "You are enrolled!" banner) unconditionally, with no
// price/payment check at all, so a priced training (e.g. 300 GEL) could be
// "enrolled" into for free with one click. A priced training must go
// through POST /payments/checkout/live-training/:id (BOG) or
// /payments/stripe/checkout/live-training/:id (Stripe) instead — the
// LiveTrainingEnrollment there is only ever created by
// liveTrainingSaleService.completeLiveTrainingPurchase, once the gateway
// actually confirms payment.
router.post('/:id/enroll', authenticate, async (req: Request, res: Response) => {
  const training = await prisma.liveTraining.findFirst({
    where: { id: req.params.id, published: true },
    include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
  });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  if (training.price && training.price > 0) {
    return res.status(400).json({ message: 'This training requires payment. Please use the registration & payment option.' });
  }

  const existing = await prisma.liveTrainingEnrollment.findUnique({
    where: { userId_liveTrainingId: { userId: req.user!.id, liveTrainingId: training.id } },
  });
  if (existing?.status === 'ACTIVE') {
    return res.status(400).json({ message: 'You are already enrolled in this training.' });
  }
  if (!existing && training._count.leads + training._count.enrollments >= training.maxCapacity) {
    return res.status(409).json({ message: 'This training is fully booked.' });
  }

  // Re-enrolling after a prior cancellation flips the same row back to
  // ACTIVE (the unique constraint on [userId, liveTrainingId] means a
  // second row can never exist) rather than creating a new one.
  const enrollment = existing
    ? await prisma.liveTrainingEnrollment.update({ where: { id: existing.id }, data: { status: 'ACTIVE', enrolledAt: new Date() } })
    : await prisma.liveTrainingEnrollment.create({ data: { userId: req.user!.id, liveTrainingId: training.id } });

  res.status(201).json({ data: enrollment });
});

router.delete('/:id/enroll', authenticate, async (req: Request, res: Response) => {
  const existing = await prisma.liveTrainingEnrollment.findUnique({
    where: { userId_liveTrainingId: { userId: req.user!.id, liveTrainingId: req.params.id } },
  });
  if (!existing || existing.status === 'CANCELLED') {
    return res.status(404).json({ message: 'You are not enrolled in this training.' });
  }
  if (existing.status === 'COMPLETED') {
    return res.status(400).json({ message: 'This cohort is already complete — enrollment can no longer be cancelled.' });
  }
  await prisma.liveTrainingEnrollment.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
  res.status(204).send();
});

export default router;
