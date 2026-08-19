import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import {
  liveTrainingCreateSchema,
  liveTrainingUpdateSchema,
  liveTrainingLeadUpdateSchema,
} from '../schemas/liveTrainingSchemas';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

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

router.get('/', async (_req: Request, res: Response) => {
  const trainings = await prisma.liveTraining.findMany({
    include: { _count: { select: { leads: true } } },
    orderBy: { scheduledAt: 'desc' },
  });
  res.json({ data: trainings.map(withCapacity) });
});

router.post('/', async (req: Request, res: Response) => {
  const result = liveTrainingCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { thumbnailUrl, ...rest } = result.data;
  const training = await prisma.liveTraining.create({
    data: { ...rest, thumbnailUrl: thumbnailUrl || null, scheduledAt: new Date(result.data.scheduledAt) },
    include: { _count: { select: { leads: true } } },
  });
  await logAdminAction({ action: 'liveTraining.create', targetType: 'LiveTraining', targetId: training.id, performedById: req.user!.id });
  res.status(201).json({ data: withCapacity(training) });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = liveTrainingUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { thumbnailUrl, scheduledAt, ...rest } = result.data;
  try {
    const training = await prisma.liveTraining.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(thumbnailUrl !== undefined ? { thumbnailUrl: thumbnailUrl || null } : {}),
        ...(scheduledAt !== undefined ? { scheduledAt: new Date(scheduledAt) } : {}),
      },
      include: { _count: { select: { leads: true } } },
    });
    await logAdminAction({ action: 'liveTraining.update', targetType: 'LiveTraining', targetId: training.id, performedById: req.user!.id });
    res.json({ data: withCapacity(training) });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Live training not found.' });
    throw err;
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.liveTraining.delete({ where: { id: req.params.id } });
    await logAdminAction({ action: 'liveTraining.delete', targetType: 'LiveTraining', targetId: req.params.id, performedById: req.user!.id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Live training not found.' });
    throw err;
  }
});

// ============================================================
// LEADS — per-training registration queue.
// ============================================================

router.get('/:id/leads', async (req: Request, res: Response) => {
  const leads = await prisma.liveTrainingLead.findMany({
    where: { liveTrainingId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: leads });
});

router.patch('/leads/:leadId', async (req: Request, res: Response) => {
  const result = liveTrainingLeadUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const lead = await prisma.liveTrainingLead.update({ where: { id: req.params.leadId }, data: result.data });
    await logAdminAction({ action: 'liveTraining.lead.update', targetType: 'LiveTrainingLead', targetId: lead.id, performedById: req.user!.id });
    res.json({ data: lead });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Lead not found.' });
    throw err;
  }
});

// Minimal hand-rolled CSV — the export is always name/email/phone/status/
// note/date, never arbitrary user-authored columns, so a library would be
// pure overhead. Quotes every field and escapes embedded quotes, which is
// the one thing that actually needs care (a name/note with a comma or
// quote in it must not corrupt the column layout).
function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

router.get('/:id/leads/export', async (req: Request, res: Response) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.id }, select: { title: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });

  const leads = await prisma.liveTrainingLead.findMany({
    where: { liveTrainingId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });

  const header = ['Name', 'Email', 'Phone', 'Status', 'Note', 'Registered At'];
  const rows = leads.map((l) =>
    [l.name, l.email, l.phone, l.status, l.adminNote ?? '', l.createdAt.toISOString()].map(csvEscape).join(',')
  );
  const csv = [header.map(csvEscape).join(','), ...rows].join('\r\n');

  const filename = `${training.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-leads.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel (still the realistic destination for this export) renders
  // Georgian text correctly instead of mangling it as Latin-1.
  res.send('﻿' + csv);
});

export default router;
