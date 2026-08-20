import { Router, Request, Response } from 'express';
import { GrantEligibilityStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { scanAllActiveSources } from '../services/grantScoutService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// --- Opportunities ---

const listQuerySchema = z.object({
  eligibilityStatus: z.nativeEnum(GrantEligibilityStatus).optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  sourceId: z.string().uuid().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const result = listQuerySchema.safeParse(req.query);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { eligibilityStatus, includeArchived, sourceId } = result.data;

  const where: Prisma.GrantOpportunityWhereInput = {
    ...(eligibilityStatus ? { eligibilityStatus } : {}),
    ...(includeArchived ? {} : { isArchived: false }),
    ...(sourceId ? { sourceId } : {}),
  };

  const opportunities = await prisma.grantOpportunity.findMany({
    where,
    include: { source: { select: { id: true, name: true } } },
    // Soonest deadline first; rows with no deadline (null) sort last since
    // Postgres orders NULLs after non-nulls by default on ASC.
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ data: opportunities });
});

router.get('/:id', async (req: Request, res: Response) => {
  const opportunity = await prisma.grantOpportunity.findUnique({
    where: { id: req.params.id },
    include: { source: { select: { id: true, name: true, baseUrl: true } } },
  });
  if (!opportunity) return res.status(404).json({ message: 'Opportunity not found.' });
  res.json({ data: opportunity });
});

const updateSchema = z.object({
  eligibilityStatus: z.nativeEnum(GrantEligibilityStatus).optional(),
  isArchived: z.boolean().optional(),
  archivedReason: z.string().trim().max(500).optional().nullable(),
});

router.patch('/:id', async (req: Request, res: Response) => {
  const opportunity = await prisma.grantOpportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ message: 'Opportunity not found.' });

  const result = updateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  if (Object.keys(result.data).length === 0) return res.status(400).json({ message: 'No fields to update.' });

  const updated = await prisma.grantOpportunity.update({
    where: { id: opportunity.id },
    data: { ...result.data, reviewedByAdminId: req.user!.id, reviewedAt: new Date() },
    include: { source: { select: { id: true, name: true } } },
  });
  await logAdminAction({ action: 'opportunities.update', targetType: 'GrantOpportunity', targetId: opportunity.id, performedById: req.user!.id, metadata: result.data });
  res.json({ data: updated });
});

// Manual trigger outside the daily cron — for testing a newly-added source
// or getting an immediate refresh without waiting for the next scheduled run.
router.post('/rescan', async (req: Request, res: Response) => {
  const result = await scanAllActiveSources();
  await logAdminAction({ action: 'opportunities.rescan', targetType: 'GrantSource', targetId: 'all', performedById: req.user!.id, metadata: { ...result } });
  res.json({
    message: `Scanned ${result.sourcesScanned} source(s) (${result.sourcesFailed} failed): ${result.newOpportunities} new opportunit(ies), ${result.newlyEligible} eligible.`,
    ...result,
  });
});

// --- Sources (SUPER_ADMIN only — same "who can edit what feeds the scan"
// sensitivity tier as PlatformAgent's set-default/unset-default) ---

router.get('/sources/all', async (_req: Request, res: Response) => {
  const sources = await prisma.grantSource.findMany({ orderBy: { name: 'asc' } });
  res.json({ data: sources });
});

const sourceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  baseUrl: z.string().trim().url(),
  listingUrls: z.array(z.string().trim().url()).min(1).max(20),
  isActive: z.boolean().optional(),
});

// No per-route requireAdminRole override here — falls through to the
// router-level SUPER_ADMIN/MANAGER gate above, same as every other route
// in this file. A prior SUPER_ADMIN-only override on this route (and
// PATCH/DELETE below) meant a MANAGER admin — who can otherwise fully use
// this page — got a 403 on submit that the frontend's generic error
// handler then misreported as an invalid-URL problem.
router.post('/sources', async (req: Request, res: Response) => {
  const result = sourceSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const source = await prisma.grantSource.create({ data: result.data });
  await logAdminAction({ action: 'opportunities.sources.create', targetType: 'GrantSource', targetId: source.id, performedById: req.user!.id });
  res.status(201).json({ data: source });
});

router.patch('/sources/:id', async (req: Request, res: Response) => {
  const source = await prisma.grantSource.findUnique({ where: { id: req.params.id } });
  if (!source) return res.status(404).json({ message: 'Source not found.' });

  const result = sourceSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const updated = await prisma.grantSource.update({ where: { id: source.id }, data: result.data });
  await logAdminAction({ action: 'opportunities.sources.update', targetType: 'GrantSource', targetId: source.id, performedById: req.user!.id, metadata: result.data });
  res.json({ data: updated });
});

router.delete('/sources/:id', async (req: Request, res: Response) => {
  const source = await prisma.grantSource.findUnique({ where: { id: req.params.id } });
  if (!source) return res.status(404).json({ message: 'Source not found.' });

  await prisma.grantSource.delete({ where: { id: source.id } });
  await logAdminAction({ action: 'opportunities.sources.delete', targetType: 'GrantSource', targetId: source.id, performedById: req.user!.id });
  res.status(204).send();
});

export default router;
