import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { liveTrainingRegisterSchema } from '../schemas/liveTrainingSchemas';
import { sendLiveTrainingRegistrationEmail, sendLiveTrainingEnrollmentEmail } from '../services/emailService';
import { sendRegistrationStatusWhatsApp, formatWhatsAppDate } from '../services/whatsappService';
import { resolveNotificationLocale } from '../utils/notificationLocale';
import { withCurrentLiveTrainingPrice, LiveTrainingPricingInput } from '../services/liveTrainingPricing';
import { withTrainingRatings } from '../services/learningRatingService';
import { lockLearningTarget, countPendingLearningSeats, reserveLearningCheckout } from '../services/learningCheckoutService';

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

// Same composition as adminLiveTrainings.ts's own withCapacityAndPrice — see
// that file's comment. Public list/detail responses need currentPrice/
// saleActive too, since that's what the course/live-training cards render.
function withCapacityAndPrice<
  T extends { minCapacity: number; maxCapacity: number; _count: { leads: number; enrollments: number } } & LiveTrainingPricingInput
>(training: T) {
  return withCurrentLiveTrainingPrice(withCapacity(training));
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
  res.json({ data: await withTrainingRatings(trainings.map(withCapacityAndPrice)) });
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

  res.json({ data: (await withTrainingRatings([{ ...withCapacityAndPrice(training), isEnrolled }]))[0] });
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
  if (!result.success) return res.status(400).json({ message: result.error.errors[0]?.message, errors: result.error.errors });

  // locale isn't a LiveTrainingLead column — it exists purely to pick the
  // notification language below, split out here so it never reaches Prisma.
  const { locale: rawLocale, ...leadData } = result.data;
  const locale = resolveNotificationLocale(rawLocale);

  const registration = await prisma.$transaction(async (tx) => {
    // Use the same row lock as checkout/free enrollment so the final seat
    // cannot be claimed by two registration paths concurrently.
    await lockLearningTarget(tx, 'LIVE_TRAINING', req.params.id);
    const training = await tx.liveTraining.findFirst({
      where: { id: req.params.id, published: true },
      include: { _count: { select: { leads: true, enrollments: enrollmentCountSelect } } },
    });
    if (!training) return { error: 'Live training not found.', status: 404 } as const;
    const existing = await tx.liveTrainingLead.findFirst({
      where: { liveTrainingId: training.id, phone: leadData.phone },
    });
    // A retry should acknowledge the saved lead without reserving another
    // seat or duplicating email/WhatsApp notifications.
    if (existing) return { training, lead: existing, duplicate: true } as const;
    const pendingSeats = await countPendingLearningSeats(tx, 'LIVE_TRAINING', training.id);
    if (training._count.leads + training._count.enrollments + pendingSeats >= training.maxCapacity) {
      return { error: 'This training is fully booked.', status: 409 } as const;
    }
    const lead = await tx.liveTrainingLead.create({ data: { liveTrainingId: training.id, ...leadData } });
    return { training, lead, duplicate: false } as const;
  });
  if (registration.status !== undefined) return res.status(registration.status).json({ message: registration.error });
  const { training, lead } = registration;
  if (registration.duplicate) return res.status(200).json({ data: { id: lead.id } });

  notifyAdminsOfNewLead(training.title, lead.name).catch((err) =>
    console.error('[liveTrainings] notifyAdminsOfNewLead failed:', err)
  );
  // Fire-and-forget, same posture as notifyAdminsOfNewLead above — a
  // Resend outage must never fail (or even slow down) the registration
  // itself; sendEmail's own try/catch already prevents a thrown error, this
  // just guards the astronomically unlikely case of a bug upstream of that.
  if (lead.email) {
    sendLiveTrainingRegistrationEmail({
      email: lead.email,
      userName: lead.name,
      courseTitle: training.title,
      startDate: training.startDate ?? training.scheduledAt,
      liveTrainingId: training.id,
      locale,
    }).catch((err) => console.error('[liveTrainings] sendLiveTrainingRegistrationEmail failed:', err));
  }
  sendRegistrationStatusWhatsApp({
    phone: lead.phone,
    firstName: lead.name,
    itemTitle: training.title,
    scheduleText: formatWhatsAppDate(training.startDate ?? training.scheduledAt, locale),
    // A lead-capture registration always precedes payment — this training
    // may be free (see the separate /enroll self-serve path below for that
    // case) or paid; either way nothing has been charged yet at this point.
    paymentStatus: 'PENDING',
    locale,
  }).catch((err) => console.error('[liveTrainings] sendRegistrationStatusWhatsApp failed:', err));

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

  // The shared lock protects free seats against concurrent lead capture,
  // paid checkout and reactivation of an earlier cancelled enrollment.
  const enrollment = await reserveLearningCheckout({
    userId: req.user!.id, purpose: 'LIVE_TRAINING', referenceId: training.id, amount: 0,
  }, (tx) => tx.liveTrainingEnrollment.upsert({
    where: { userId_liveTrainingId: { userId: req.user!.id, liveTrainingId: training.id } },
    create: { userId: req.user!.id, liveTrainingId: training.id },
    update: { status: 'ACTIVE', enrolledAt: new Date(), completedAt: null },
  }));

  // Self-serve enroll has no lead-form field to carry a locale (unlike
  // /register), so the frontend sends it as a small request body instead
  // (see liveTrainingService.ts's enrollInLiveTraining) — the site's
  // currently-active locale at the moment the student clicked Enroll.
  const enrollLocale = resolveNotificationLocale(typeof req.body?.locale === 'string' ? req.body.locale : undefined);

  // req.user only carries id/role/email (see middleware/auth.ts) — name
  // isn't in the JWT payload, so it needs its own lookup for the email's
  // {{userName}}. Fire-and-forget, same posture as the /register email above.
  prisma.user
    .findUnique({ where: { id: req.user!.id }, select: { name: true, email: true, phone: true } })
    .then((user) => {
      if (!user) return;
      sendLiveTrainingEnrollmentEmail({
        email: user.email,
        userName: user.name,
        courseTitle: training.title,
        startDate: training.startDate,
        meetLink: training.meetingUrl,
        classroomLink: training.classroomUrl,
        locale: enrollLocale,
      }).catch((err) => console.error('[liveTrainings] sendLiveTrainingEnrollmentEmail failed:', err));
      // No phone on file (User.phone is optional) simply skips the
      // WhatsApp send — email above already covers the notification.
      if (user.phone) {
        sendRegistrationStatusWhatsApp({
          phone: user.phone,
          firstName: user.name,
          itemTitle: training.title,
          scheduleText: formatWhatsAppDate(training.startDate, enrollLocale),
          // This endpoint is FREE-trainings-only (see its own guard above)
          // and enrolls immediately — nothing was ever pending here.
          paymentStatus: 'PAID',
          locale: enrollLocale,
          accessNote:
            training.meetingUrl || training.classroomUrl
              ? [training.meetingUrl, training.classroomUrl].filter(Boolean).join(' | ')
              : undefined,
        }).catch((err) => console.error('[liveTrainings] sendRegistrationStatusWhatsApp failed:', err));
      }
    })
    .catch((err) => console.error('[liveTrainings] enrollment-notification user lookup failed:', err));

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
