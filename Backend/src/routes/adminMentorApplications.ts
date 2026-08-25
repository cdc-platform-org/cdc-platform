import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { mentorApplicationRejectSchema } from '../schemas/mentorApplicationSchemas';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
// Same tier as adminMentorship.ts's promote/demote endpoints — this queue
// ends in the identical role change, so it needs the identical permission.
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const applicantSelect = { select: { id: true, name: true, email: true, role: true } };

router.get('/', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const applications = await prisma.mentorApplication.findMany({
    where: status ? { status: status as any } : undefined,
    include: { user: applicantSelect, reviewedBy: applicantSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: applications });
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const application = await prisma.mentorApplication.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!application) return res.status(404).json({ message: 'Application not found.' });
  if (application.status !== 'PENDING') {
    return res.status(400).json({ message: 'This application has already been reviewed.' });
  }
  if (application.user.role === 'Mentor') {
    // Another route (or a concurrent approval on a second pending
    // application from the same user, if one somehow existed) already
    // granted it — still mark this one reviewed rather than leaving it
    // stuck PENDING forever.
    await prisma.mentorApplication.update({
      where: { id: application.id },
      data: { status: 'APPROVED', reviewedById: req.user!.id, reviewedAt: new Date() },
    });
    return res.status(400).json({ message: 'This user is already a Mentor.' });
  }
  if (application.user.role === 'SuperAdmin') {
    return res.status(400).json({ message: "Cannot change a SuperAdmin's role." });
  }

  const [, updatedApplication] = await prisma.$transaction([
    // Identical role update to adminMentorship.ts's POST /mentors/promote —
    // see that route's own comment for why preMentorRole is captured.
    prisma.user.update({
      where: { id: application.userId },
      data: { role: 'Mentor', preMentorRole: application.user.role },
    }),
    prisma.mentorApplication.update({
      where: { id: application.id },
      data: { status: 'APPROVED', reviewedById: req.user!.id, reviewedAt: new Date() },
      include: { user: applicantSelect },
    }),
  ]);

  await logAdminAction({
    action: 'mentorApplication.approve',
    targetType: 'MentorApplication',
    targetId: application.id,
    performedById: req.user!.id,
    metadata: { userId: application.userId },
  });

  res.json({ data: updatedApplication });
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const result = mentorApplicationRejectSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const claim = await prisma.mentorApplication.updateMany({
    where: { id: req.params.id, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      rejectionReason: result.data.rejectionReason,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    },
  });
  if (claim.count === 0) {
    const exists = await prisma.mentorApplication.findUnique({ where: { id: req.params.id } });
    return res.status(exists ? 400 : 404).json({
      message: exists ? 'This application has already been reviewed.' : 'Application not found.',
    });
  }

  const application = await prisma.mentorApplication.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { user: applicantSelect },
  });

  await logAdminAction({
    action: 'mentorApplication.reject',
    targetType: 'MentorApplication',
    targetId: application.id,
    performedById: req.user!.id,
    metadata: { userId: application.userId, reason: result.data.rejectionReason },
  });

  res.json({ data: application });
});

export default router;
