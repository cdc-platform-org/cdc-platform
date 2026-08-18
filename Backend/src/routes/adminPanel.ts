import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import {
  setAdminRoleSchema,
  addTeamMemberSchema,
  moderateListingSchema,
  updateBogSettingsSchema,
  manualCertificateSchema,
} from '../schemas/adminSchemas';
import { getAiAutomationSettings } from '../services/aiAutomationSettingsService';
import { generateCertificatePdf, generateVerificationCode, CertificateTemplateMissingError } from '../services/certificateService';
import { sendCertificateEmail } from '../services/emailService';

const router = Router();
const participantSelect = { select: { id: true, name: true, email: true, role: true, adminRole: true } };

router.use(authenticate);

// ============================================================
// DASHBOARD OVERVIEW — any admin tier. Headline KPIs only; the detailed
// transaction ledger lives under /financials/transactions (SUPER_ADMIN only).
// ============================================================
router.get('/dashboard-stats', requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'), async (_req, res) => {
  const [
    totalUsers,
    pendingApproval,
    bannedUsers,
    studentCount,
    clientCount,
    gigsByStatus,
    vacanciesByStatus,
    volumeAgg,
    salesVolumeAgg,
    openDisputes,
    pendingPayouts,
    examSubmissionsByStatus,
    flaggedSubmissionsLast7Days,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { role: 'Student' } }),
    prisma.user.count({ where: { role: 'Client' } }),
    prisma.gig.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.vacancy.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.gigTransaction.aggregate({
      _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
      _count: { _all: true },
    }),
    // Course/product/mentorship sales — GIG_ESCROW_FUNDING is deliberately
    // excluded here since funding a gig's escrow creates a GigTransaction
    // (captured above), so including it too would double-count that volume.
    prisma.bogPayment.aggregate({
      where: { status: 'COMPLETED', purpose: { in: ['COURSE', 'MENTORSHIP', 'PRODUCT'] } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.dispute.count({ where: { status: 'OPEN' } }),
    prisma.payoutRequest.count({ where: { status: 'PENDING' } }),
    prisma.examSubmission.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.examSubmission.count({
      where: { status: 'FLAGGED', startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const examStatusCounts = Object.fromEntries(examSubmissionsByStatus.map((s) => [s.status, s._count._all]));

  const gigStatusCounts = Object.fromEntries(gigsByStatus.map((g) => [g.status, g._count._all]));
  const vacancyStatusCounts = Object.fromEntries(vacanciesByStatus.map((v) => [v.status, v._count._all]));
  const activeGigs = (gigStatusCounts['open'] ?? 0) + (gigStatusCounts['assigned'] ?? 0) + (gigStatusCounts['submitted'] ?? 0);

  res.json({
    users: {
      total: totalUsers,
      pendingApproval,
      banned: bannedUsers,
      students: studentCount,
      clients: clientCount,
    },
    gigs: {
      total: Object.values(gigStatusCounts).reduce((a, b) => a + b, 0),
      active: activeGigs,
      byStatus: gigStatusCounts,
    },
    vacancies: {
      total: Object.values(vacancyStatusCounts).reduce((a, b) => a + b, 0),
      byStatus: vacancyStatusCounts,
    },
    volume: {
      // Commission/net splits are freelancer-marketplace-specific (no
      // equivalent for a straight course/product sale), so those two stay
      // gig-transaction-only — only the gross total blends both sources.
      totalGrossAmount: (volumeAgg._sum.grossAmount ?? 0) + (salesVolumeAgg._sum.amount ?? 0),
      totalCommissionAmount: volumeAgg._sum.commissionAmount ?? 0,
      totalNetAmount: volumeAgg._sum.netAmount ?? 0,
      transactionCount: volumeAgg._count._all + salesVolumeAgg._count._all,
    },
    disputes: {
      open: openDisputes,
    },
    payouts: {
      pending: pendingPayouts,
    },
    examProctoring: {
      total: Object.values(examStatusCounts).reduce((a, b) => a + b, 0),
      inProgress: examStatusCounts['IN_PROGRESS'] ?? 0,
      completed: examStatusCounts['COMPLETED'] ?? 0,
      flagged: examStatusCounts['FLAGGED'] ?? 0,
      flaggedLast7Days: flaggedSubmissionsLast7Days,
    },
  });
});

// ============================================================
// GIGS & VACANCIES MODERATION — any admin tier. Post-hoc moderation: listings
// go live immediately on posting (unchanged); this lets a mod take one down
// after the fact, or restore it. Not a pre-publish approval queue.
// ============================================================
router.get('/listings', requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'), async (req, res) => {
  const { type, moderationStatus } = req.query;
  const modFilter = moderationStatus ? { moderationStatus: moderationStatus as 'approved' | 'removed' } : {};

  const [gigs, vacancies] = await Promise.all([
    type === 'vacancy'
      ? []
      : prisma.gig.findMany({
          where: modFilter,
          include: { postedBy: participantSelect },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
    type === 'gig'
      ? []
      : prisma.vacancy.findMany({
          where: modFilter,
          include: { postedBy: participantSelect },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
  ]);

  res.json({
    data: [
      ...gigs.map((g) => ({ ...g, listingType: 'gig' as const })),
      ...vacancies.map((v) => ({ ...v, listingType: 'vacancy' as const })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  });
});

router.post(
  '/gigs/:id/moderate',
  requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'),
  async (req: Request, res: Response) => {
    const result = moderateListingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const gig = await prisma.gig.findUnique({ where: { id: req.params.id } });
    if (!gig) return res.status(404).json({ message: 'Gig not found.' });
    const updated = await prisma.gig.update({
      where: { id: gig.id },
      data: {
        moderationStatus: 'removed',
        moderatedAt: new Date(),
        moderationReason: result.data.reason ?? null,
      },
    });
    res.json(updated);
  }
);

router.post(
  '/gigs/:id/restore',
  requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'),
  async (req: Request, res: Response) => {
    const gig = await prisma.gig.findUnique({ where: { id: req.params.id } });
    if (!gig) return res.status(404).json({ message: 'Gig not found.' });
    const updated = await prisma.gig.update({
      where: { id: gig.id },
      data: { moderationStatus: 'approved', moderatedAt: new Date(), moderationReason: null },
    });
    res.json(updated);
  }
);

router.post(
  '/vacancies/:id/moderate',
  requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'),
  async (req: Request, res: Response) => {
    const result = moderateListingSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ errors: result.error.errors });
    const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.id } });
    if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
    const updated = await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: {
        moderationStatus: 'removed',
        moderatedAt: new Date(),
        moderationReason: result.data.reason ?? null,
      },
    });
    res.json(updated);
  }
);

router.post(
  '/vacancies/:id/restore',
  requireAdminRole('SUPER_ADMIN', 'MANAGER', 'MODERATOR'),
  async (req: Request, res: Response) => {
    const vacancy = await prisma.vacancy.findUnique({ where: { id: req.params.id } });
    if (!vacancy) return res.status(404).json({ message: 'Vacancy not found.' });
    const updated = await prisma.vacancy.update({
      where: { id: vacancy.id },
      data: { moderationStatus: 'approved', moderatedAt: new Date(), moderationReason: null },
    });
    res.json(updated);
  }
);

// ============================================================
// FINANCIALS & BOG TRANSACTIONS — SUPER_ADMIN only.
// ============================================================
router.get('/financials/transactions', requireAdminRole('SUPER_ADMIN'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

  const [transactions, totalCount] = await Promise.all([
    prisma.gigTransaction.findMany({
      include: {
        gig: { select: { id: true, title: true } },
        client: participantSelect,
        freelancer: participantSelect,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.gigTransaction.count(),
  ]);

  res.json({ data: transactions, totalCount, page, pageSize });
});

// Raw BOG payment ledger — every BogPayment row across all four checkout
// purposes (course/mentorship/gig-escrow-funding/product), any status
// (PENDING/COMPLETED/FAILED/CANCELLED), not just gig escrow. This is what
// GigTransaction-only /financials/transactions above doesn't cover — course
// and product sales otherwise had no admin-visible ledger at all.
router.get('/bog-payments', requireAdminRole('SUPER_ADMIN'), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

  const [payments, totalCount] = await Promise.all([
    prisma.bogPayment.findMany({
      include: { user: participantSelect, promoCode: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.bogPayment.count(),
  ]);

  const courseIds = payments.filter((p) => p.purpose === 'COURSE').map((p) => p.referenceId);
  const courses = courseIds.length
    ? await prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } })
    : [];
  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

  const productIds = payments.filter((p) => p.purpose === 'PRODUCT').map((p) => p.referenceId);
  const products = productIds.length
    ? await prisma.digitalProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, title: true } })
    : [];
  const productTitleById = new Map(products.map((p) => [p.id, p.title]));

  res.json({
    data: payments.map((p) => ({
      id: p.id,
      bogOrderId: p.bogOrderId,
      user: p.user,
      purpose: p.purpose,
      referenceId: p.referenceId,
      referenceTitle:
        p.purpose === 'COURSE'
          ? courseTitleById.get(p.referenceId) ?? null
          : p.purpose === 'PRODUCT'
          ? productTitleById.get(p.referenceId) ?? null
          : null,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      promoCode: p.promoCode?.code ?? null,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    })),
    totalCount,
    page,
    pageSize,
  });
});

// BOG (Bank of Georgia) payment gateway config — real integration lives in
// services/bogPaymentService.ts + routes/payments.ts. clientId/secretKey here
// are the OAuth2 client_credentials BOG issues per-merchant; they're the DB
// fallback bogPaymentService reads when BOG_CLIENT_ID/BOG_SECRET_KEY env vars
// aren't set (see getBogCredentials()).
router.get('/bog-settings', requireAdminRole('SUPER_ADMIN'), async (_req, res) => {
  const settings = await prisma.bogSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!settings) {
    return res.json({ data: null });
  }
  res.json({
    data: {
      clientId: settings.clientId,
      secretKey: maskSecret(settings.secretKey),
      isLiveMode: settings.isLiveMode,
      updatedByEmail: settings.updatedByEmail,
      updatedAt: settings.updatedAt,
    },
  });
});

router.put('/bog-settings', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = updateBogSettingsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const existing = await prisma.bogSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  const data = {
    ...result.data,
    updatedByEmail: req.user!.email,
  };
  const settings = existing
    ? await prisma.bogSettings.update({ where: { id: existing.id }, data })
    : await prisma.bogSettings.create({ data });

  res.json({
    data: {
      clientId: settings.clientId,
      secretKey: maskSecret(settings.secretKey),
      isLiveMode: settings.isLiveMode,
      updatedByEmail: settings.updatedByEmail,
      updatedAt: settings.updatedAt,
    },
  });
});

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

// ============================================================
// AI AUTOMATION — sensitivity/auto-publish knobs for the platform's
// autonomous AI agents (productModerationService.ts, blogAgentService.ts).
// See aiAutomationSettingsService.ts for the singleton read helper both
// agents actually consult; these routes are just the admin CMS surface.
// ============================================================
router.get('/ai-automation-settings', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (_req, res) => {
  res.json({ data: await getAiAutomationSettings() });
});

const updateAiAutomationSettingsSchema = z.object({
  autoApproveScoreThreshold: z.number().int().min(0).max(100).optional(),
  autoApproveConfidenceThreshold: z.number().int().min(0).max(100).optional(),
  blogAutoPublish: z.boolean().optional(),
});

router.put('/ai-automation-settings', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = updateAiAutomationSettingsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const existing = await prisma.aiAutomationSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  const data = { ...result.data, updatedByEmail: req.user!.email };
  const settings = existing
    ? await prisma.aiAutomationSettings.update({ where: { id: existing.id }, data })
    : await prisma.aiAutomationSettings.create({ data });

  res.json({
    data: {
      autoApproveScoreThreshold: settings.autoApproveScoreThreshold,
      autoApproveConfidenceThreshold: settings.autoApproveConfidenceThreshold,
      blogAutoPublish: settings.blogAutoPublish,
      updatedByEmail: settings.updatedByEmail,
      updatedAt: settings.updatedAt,
    },
  });
});

// ============================================================
// TEAM & PERMISSIONS — SUPER_ADMIN only.
// ============================================================
router.get('/team', requireAdminRole('SUPER_ADMIN'), async (_req, res) => {
  const team = await prisma.user.findMany({
    where: { adminRole: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRole: true,
      isBanned: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: team });
});

router.post('/team', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = addTeamMemberSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { email: result.data.email.toLowerCase() } });
  if (!user) {
    return res
      .status(404)
      .json({ message: 'No platform account with that email exists yet — they need to register first.' });
  }
  if (user.adminRole) {
    return res.status(400).json({ message: 'This user is already on the admin team.' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { adminRole: result.data.adminRole },
    select: { id: true, name: true, email: true, role: true, adminRole: true, isBanned: true, createdAt: true },
  });
  res.status(201).json({ data: updated });
});

router.put('/team/:userId', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const result = setAdminRoleSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || !user.adminRole) {
    return res.status(404).json({ message: 'This user is not on the admin team.' });
  }
  if (user.id === req.user!.id && result.data.adminRole !== 'SUPER_ADMIN') {
    return res.status(400).json({ message: 'You cannot downgrade your own admin role.' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { adminRole: result.data.adminRole },
    select: { id: true, name: true, email: true, role: true, adminRole: true, isBanned: true, createdAt: true },
  });
  res.json({ data: updated });
});

router.delete('/team/:userId', requireAdminRole('SUPER_ADMIN'), async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!user || !user.adminRole) {
    return res.status(404).json({ message: 'This user is not on the admin team.' });
  }
  if (user.id === req.user!.id) {
    return res.status(400).json({ message: 'You cannot remove yourself from the admin team.' });
  }
  if (user.adminRole === 'SUPER_ADMIN') {
    const remainingSuperAdmins = await prisma.user.count({ where: { adminRole: 'SUPER_ADMIN' } });
    if (remainingSuperAdmins <= 1) {
      return res.status(400).json({ message: 'Cannot remove the last remaining SuperAdmin.' });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { adminRole: null } });
  res.status(204).send();
});

// ============================================================
// MANUAL CERTIFICATE ISSUANCE — for graduates/courses that predate the LMS
// or otherwise don't exist as real User/Course rows (see ManualCertificate
// in schema.prisma). Reuses the exact same PDF renderer as the automatic
// CourseCertificate flow (services/certificateService.ts), so layout/
// bilingual formatting is guaranteed identical either way.
// ============================================================
router.post('/certificates/preview', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = manualCertificateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const data = result.data;

  try {
    const issueDate = new Date(data.issueDate);
    const pdfBuffer = await generateCertificatePdf({
      studentName: data.studentNameKa,
      studentNameSecondary: data.studentNameEn || null,
      courseTitle: data.courseTitleKa,
      courseTitleEn: data.courseTitleEn || null,
      instructorName: data.instructorName,
      issueDate,
      // Preview only — a real, unique code is minted (and persisted) in
      // /certificates/issue-manual below, never here.
      verificationCode: generateVerificationCode(issueDate),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="certificate-preview.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    if (err instanceof CertificateTemplateMissingError) {
      return res.status(503).json({ message: 'Certificate template is not configured yet.' });
    }
    throw err;
  }
});

router.post('/certificates/issue-manual', requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = manualCertificateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const data = result.data;
  const issueDate = new Date(data.issueDate);
  const verificationCode = generateVerificationCode(issueDate);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCertificatePdf({
      studentName: data.studentNameKa,
      studentNameSecondary: data.studentNameEn || null,
      courseTitle: data.courseTitleKa,
      courseTitleEn: data.courseTitleEn || null,
      instructorName: data.instructorName,
      issueDate,
      verificationCode,
    });
  } catch (err) {
    if (err instanceof CertificateTemplateMissingError) {
      return res.status(503).json({ message: 'Certificate template is not configured yet.' });
    }
    throw err;
  }

  const certificate = await prisma.manualCertificate.create({
    data: {
      verificationCode,
      studentNameKa: data.studentNameKa,
      studentNameEn: data.studentNameEn || null,
      studentEmail: data.studentEmail,
      courseTitleKa: data.courseTitleKa,
      courseTitleEn: data.courseTitleEn || null,
      instructorName: data.instructorName,
      issueDate,
      issuedByAdminId: req.user!.id,
    },
  });

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendCertificateEmail(
      data.studentEmail,
      data.studentNameKa,
      data.courseTitleKa,
      pdfBuffer,
      `CDC-Certificate-${verificationCode}.pdf`,
      verificationCode
    );
    emailSent = true;
    await prisma.manualCertificate.update({ where: { id: certificate.id }, data: { emailSentAt: new Date() } });
  } catch (err) {
    // The certificate record + PDF are already created — a failed send is
    // reported back so the admin can retry/resend rather than silently
    // losing the fact that the student never got their email.
    emailError = err instanceof Error ? err.message : 'Email send failed.';
  }

  res.status(201).json({ data: { ...certificate, emailSent, emailError } });
});

export default router;
