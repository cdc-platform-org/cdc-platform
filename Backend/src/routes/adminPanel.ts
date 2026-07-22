import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import {
  setAdminRoleSchema,
  addTeamMemberSchema,
  moderateListingSchema,
  updateBogSettingsSchema,
} from '../schemas/adminSchemas';

const router = Router();
const participantSelect = { select: { id: true, name: true, email: true, role: true, adminRole: true } };

router.use(authenticate);

// ============================================================
// DASHBOARD OVERVIEW — any admin tier. Headline KPIs only; the detailed
// transaction ledger lives under /financials/transactions (SUPER_ADMIN only).
// ============================================================
router.get('/dashboard-stats', requireAdminRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'), async (_req, res) => {
  const [
    totalUsers,
    pendingApproval,
    bannedUsers,
    studentCount,
    clientCount,
    gigsByStatus,
    vacanciesByStatus,
    volumeAgg,
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
  ]);

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
      totalGrossAmount: volumeAgg._sum.grossAmount ?? 0,
      totalCommissionAmount: volumeAgg._sum.commissionAmount ?? 0,
      totalNetAmount: volumeAgg._sum.netAmount ?? 0,
      transactionCount: volumeAgg._count._all,
    },
  });
});

// ============================================================
// GIGS & VACANCIES MODERATION — any admin tier. Post-hoc moderation: listings
// go live immediately on posting (unchanged); this lets a mod take one down
// after the fact, or restore it. Not a pre-publish approval queue.
// ============================================================
router.get('/listings', requireAdminRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'), async (req, res) => {
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
  requireAdminRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
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
  requireAdminRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
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
  requireAdminRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
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
  requireAdminRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR'),
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

export default router;
