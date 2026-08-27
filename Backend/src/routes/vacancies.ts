import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, requireApproved } from '../middleware/auth';
import { postVacancySchema, updateVacancySchema, applyToVacancySchema, reviewVacancyApplicationSchema } from '../schemas/vacancySchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { sendVacancyApplicationEmail } from '../services/emailService';
import { hasReachedDailyPostLimit } from '../services/postingLimitService';
import { canPostListing, VERIFICATION_REQUIRED_TO_POST_MESSAGE } from '../utils/freelancerVerification';
const router = Router();
// _count.courseEnrollments drives the "სტუდენტი" badge on listing cards —
// see the hasPurchasedCourse comment on routes/reviews.ts's profile route.
// Reused across every endpoint below (list/mine/detail/applications), so
// adding it here is the one edit that surfaces it everywhere postedBy is
// returned, no per-handler changes needed.
// verificationLevel/verificationStatus/isVerified alongside isVerifiedGraduate
// so listing cards can render the full multi-role verification badge set
// (Student/Freelancer/Business — see Frontend's VerificationBadges.tsx).
const posterSelect = {
  select: {
    id: true,
    name: true,
    role: true,
    isVerifiedGraduate: true,
    verificationLevel: true,
    verificationStatus: true,
    isVerified: true,
    averageRating: true,
    reviewCount: true,
    _count: { select: { courseEnrollments: true } },
  },
};
const applicantSelect = {
  select: {
    name: true,
    isVerifiedGraduate: true,
    verificationLevel: true,
    verificationStatus: true,
    isVerified: true,
    averageRating: true,
    reviewCount: true,
    cvUrl: true,
    _count: { select: { courseEnrollments: true } },
  },
};
declare global {
  namespace Express {
    interface Request {
      vacancy?: NonNullable<Awaited<ReturnType<typeof prisma.vacancy.findUnique>>>;
    }
  }
}
async function loadVacancy(req: Request, res: Response, next: NextFunction) {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.id } });
  if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
  req.vacancy = vacancy;
  next();
}
function requireVacancyOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.vacancy) return res.status(401).json({ message: 'Authentication required.' });
  const isOwner = req.vacancy.postedById === req.user.id;
  const isAdmin = req.user.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(404).json({ message: 'Vacancy not found.' });
  next();
}
// Client Portal — vacancies the caller posted, including drafts (the public
// routes below always exclude drafts). Must be registered before GET /:id,
// or a request to /mine would match :id="mine".
router.get('/mine', authenticate, requireApproved, async (req: Request, res: Response) => {
  const vacancies = await prisma.vacancy.findMany({
    where: { postedById: req.user!.id },
    include: { postedBy: posterSelect, _count: { select: { applications: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(vacancies);
});
// Public — guests can browse vacancy listings without logging in. Drafts
// never appear here regardless of moderation status.
router.get('/', async (req: Request, res: Response) => {
  const { skills, employmentType, location, category } = req.query;
  const where: Record<string, unknown> = { moderationStatus: 'approved', status: { not: 'draft' } };
  if (employmentType) where.employmentType = employmentType;
  if (location) where.location = { contains: String(location), mode: 'insensitive' };
  if (category) where.category = category;
  if (skills) where.skillsRequired = { hasSome: String(skills).split(',').map((s) => s.trim()) };
  const vacancies = await prisma.vacancy.findMany({
    where,
    include: { postedBy: posterSelect },
    orderBy: { createdAt: 'desc' },
    // Defensive cap, not real pagination — see gigs.ts's identical public
    // browse route for the same reasoning; response shape (a plain array)
    // stays unchanged for existing callers.
    take: 300,
  });
  res.json(vacancies);
});
router.get('/:id', async (req: Request, res: Response) => {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: req.params.id },
    include: { postedBy: posterSelect },
  });
  // A draft is only ever visible through the owner-scoped GET /mine above —
  // this route has no authentication, so there's no way to check ownership
  // here; treating a draft as 404 (rather than relaxing auth) keeps it
  // simple and keeps this route fully public/cacheable for everything else.
  if (!vacancy || vacancy.status === 'draft') return res.status(404).json({ message: 'Vacancy not found.' });
  res.json(vacancy);
});
// Open to any authenticated, approved account — see gigs.ts's identical
// POST / comment for the reasoning, including the canPostListing() hard
// verification gate. hasReachedDailyPostLimit still applies to every
// non-admin poster.
router.post(
  '/',
  authenticate,
  requireApproved,
  async (req: Request, res: Response) => {
    if (req.user!.role !== 'SuperAdmin' && (await hasReachedDailyPostLimit(req.user!.id))) {
      return res.status(429).json({ message: 'You have reached your daily posting limit. Try again tomorrow.' });
    }
    if (!(await canPostListing(prisma, req.user!.id, req.user!.role))) {
      return res.status(403).json({ message: VERIFICATION_REQUIRED_TO_POST_MESSAGE });
    }
    const result = postVacancySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const { status, ...fields } = result.data;
    const vacancy = await prisma.vacancy.create({
      data: {
        ...fields,
        salaryMin: result.data.salaryMin ?? null,
        salaryMax: result.data.salaryMax ?? null,
        currency: result.data.currency ?? null,
        applicationDeadline: result.data.applicationDeadline ?? null,
        postedById: req.user!.id,
        status: status ?? 'open',
      },
      include: { postedBy: posterSelect },
    });
    res.status(201).json(vacancy);
  }
);
router.put(
  '/:id',
  authenticate,
  loadVacancy,
  requireVacancyOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const result = updateVacancySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const { salaryMin, salaryMax, applicationDeadline, ...rest } = result.data;
    const vacancy = await prisma.vacancy.update({
      where: { id: req.vacancy!.id },
      data: {
        ...rest,
        ...(salaryMin !== undefined && { salaryMin: salaryMin ?? null }),
        ...(salaryMax !== undefined && { salaryMax: salaryMax ?? null }),
        ...(applicationDeadline !== undefined && { applicationDeadline: applicationDeadline ?? null }),
      },
      include: { postedBy: posterSelect },
    });
    res.json(vacancy);
  }
);
router.post(
  '/:id/apply',
  authenticate,
  requireApproved,
  requireRole('Student'),
  loadVacancy,
  async (req: Request, res: Response) => {
    if (req.vacancy!.status !== 'open') {
      return res.status(400).json({ message: 'This vacancy is no longer accepting applications.' });
    }
    // Deliberately NOT gated on hasFreelancerRights() — see gigs.ts's
    // identical comment on its own /apply route. Soft nudge, not a hard
    // block; the employer sees a Verified/Standard badge on the applicant.
    const result = applyToVacancySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    try {
      const application = await prisma.vacancyApplication.create({
        data: {
          vacancyId: req.vacancy!.id,
          applicantId: req.user!.id,
          coverNote: result.data.coverNote,
          status: 'submitted',
        },
        include: { applicant: applicantSelect },
      });

      // Kick off a real message thread with the employer + notify them by
      // email — the application shouldn't just sit in a list with no way
      // for either side to actually talk.
      const employer = await prisma.user.findUnique({ where: { id: req.vacancy!.postedById } });
      if (employer && employer.id !== req.user!.id) {
        const { sanitized } = sanitizeChatMessage(
          `Applied to "${req.vacancy!.title}":\n\n${result.data.coverNote}`
        );
        await prisma.message.create({
          data: { senderId: req.user!.id, recipientId: employer.id, content: sanitized },
        });
        await sendVacancyApplicationEmail(employer.email, application.applicant.name, req.vacancy!.title, req.user!.id);
      }

      res.status(201).json(application);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ message: 'You have already applied to this vacancy.' });
      }
      throw err;
    }
  }
);
router.get(
  '/:id/applications',
  authenticate,
  loadVacancy,
  requireVacancyOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const applications = await prisma.vacancyApplication.findMany({
      where: { vacancyId: req.vacancy!.id },
      include: { applicant: applicantSelect },
      orderBy: { createdAt: 'desc' },
    });
    res.json(applications);
  }
);
router.post(
  '/:id/applications/:appId/review',
  authenticate,
  loadVacancy,
  requireVacancyOwnerOrAdmin,
  async (req: Request, res: Response) => {
    const result = reviewVacancyApplicationSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const application = await prisma.vacancyApplication.findFirst({
      where: { id: req.params.appId, vacancyId: req.vacancy!.id },
    });
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    const updated = await prisma.vacancyApplication.update({
      where: { id: application.id },
      data: { status: result.data.decision },
      include: { applicant: applicantSelect },
    });
    res.json(updated);
  }
);
export default router;
