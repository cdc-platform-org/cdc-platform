import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, requireApproved } from '../middleware/auth';
import { postVacancySchema, applyToVacancySchema, reviewVacancyApplicationSchema } from '../schemas/vacancySchemas';
import { sanitizeChatMessage } from '../utils/sanitizeChatMessage';
import { sendVacancyApplicationEmail } from '../services/emailService';
const router = Router();
const posterSelect = { select: { id: true, name: true, role: true } };
declare global {
  namespace Express {
    interface Request {
      vacancy?: NonNullable<Awaited<ReturnType<typeof prisma.vacancy.findUnique>>>;
    }
  }
}
async function loadVacancy(req: Request, res: Response, next: Function) {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.id } });
  if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
  req.vacancy = vacancy;
  next();
}
function requireVacancyOwnerOrAdmin(req: Request, res: Response, next: Function) {
  if (!req.user || !req.vacancy) return res.status(401).json({ message: 'Authentication required.' });
  const isOwner = req.vacancy.postedById === req.user.id;
  const isAdmin = req.user.role === 'SuperAdmin';
  if (!isOwner && !isAdmin) return res.status(404).json({ message: 'Vacancy not found.' });
  next();
}
// Public — guests can browse vacancy listings without logging in.
router.get('/', async (req: Request, res: Response) => {
  const { skills, employmentType, location } = req.query;
  const where: Record<string, unknown> = { moderationStatus: 'approved' };
  if (employmentType) where.employmentType = employmentType;
  if (location) where.location = { contains: String(location), mode: 'insensitive' };
  if (skills) where.skillsRequired = { hasSome: String(skills).split(',').map((s) => s.trim()) };
  const vacancies = await prisma.vacancy.findMany({
    where,
    include: { postedBy: posterSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json(vacancies);
});
router.get('/:id', async (req: Request, res: Response) => {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: req.params.id },
    include: { postedBy: posterSelect },
  });
  if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
  res.json(vacancy);
});
router.post(
  '/',
  authenticate,
  requireApproved,
  requireRole('Client', 'SuperAdmin'),
  async (req: Request, res: Response) => {
    const result = postVacancySchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const vacancy = await prisma.vacancy.create({
      data: {
        ...result.data,
        salaryMin: result.data.salaryMin ?? null,
        salaryMax: result.data.salaryMax ?? null,
        currency: result.data.currency ?? null,
        applicationDeadline: result.data.applicationDeadline ?? null,
        postedById: req.user!.id,
        status: 'open',
      },
      include: { postedBy: posterSelect },
    });
    res.status(201).json(vacancy);
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
        include: { applicant: { select: { name: true } } },
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
      include: { applicant: { select: { name: true } } },
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
      include: { applicant: { select: { name: true } } },
    });
    res.json(updated);
  }
);
export default router;
