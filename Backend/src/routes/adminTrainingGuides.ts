import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { guideSettingsSchema, guideSourceSchema, trainingDaySchema } from '../schemas/trainingGuideSchemas';
import { getTrainingGuides, getGuideMetrics, guideConfiguration, importVibeCodingGuides, resolveGuideSchedule, TrainingGuideError } from '../services/trainingGuideService';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use('/:trainingId/guides', authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req, res, next) => {
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.trainingId }, select: { id: true } });
  if (!training) return res.status(404).json({ message: 'Training not found.' });
  next();
});
async function audit(trainingId: string, userId: string, action: string) {
  await logAdminAction({ action, targetType: 'TRAINING_GUIDE', targetId: trainingId, performedById: userId });
}
router.get('/:trainingId/guides', async (req, res) => {
  const guides = await getTrainingGuides(req.params.trainingId, req.user!.id, true);
  const days = await prisma.trainingDay.findMany({ where: { liveTrainingId: req.params.trainingId }, orderBy: { dayNumber: 'asc' } });
  const [metrics, sources] = await Promise.all([
    getGuideMetrics(req.params.trainingId, days),
    prisma.trainingGuideSource.findMany({ where: { liveTrainingId: req.params.trainingId }, orderBy: [{ dayNumber: 'asc' }, { id: 'asc' }] }),
  ]);
  res.json({ data: { ...guides, metrics, sources } });
});
router.patch('/:trainingId/guides/settings', async (req, res) => {
  const result = guideSettingsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const trainingId = req.params.trainingId;
  const data = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    const existing = await guideConfiguration(trainingId);
    const days = await tx.trainingDay.findMany({ where: { liveTrainingId: trainingId } });
    const settings = { ...existing, ...result.data };
    if (settings.currentDayOverride != null && !days.some((day) => day.dayNumber === settings.currentDayOverride)) throw new TrainingGuideError(400, 'Choose an existing training day.');
    if (settings.paused && !existing.paused) settings.pausedDayNumber = resolveGuideSchedule(days, existing).currentDayNumber;
    if (!settings.paused) settings.pausedDayNumber = null;
    const values = { timeZone: settings.timeZone, startDate: settings.startDate, paused: settings.paused,
      pausedDayNumber: settings.pausedDayNumber, currentDayOverride: settings.currentDayOverride, visibility: settings.visibility };
    return tx.trainingGuideSettings.upsert({ where: { liveTrainingId: trainingId }, create: { liveTrainingId: trainingId, ...values }, update: values });
  });
  await audit(trainingId, req.user!.id, 'TRAINING_GUIDE_SETTINGS_UPDATED');
  res.json({ data });
});
router.post('/:trainingId/guides/days', async (req, res) => {
  const result = trainingDaySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const trainingId = req.params.trainingId;
  const day = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    if (await tx.trainingDay.findUnique({ where: { liveTrainingId_dayNumber: { liveTrainingId: trainingId, dayNumber: result.data.dayNumber } } })) throw new TrainingGuideError(409, 'That day number is already in use.');
    return tx.trainingDay.create({ data: { ...result.data, liveTrainingId: trainingId, sections: result.data.sections as Prisma.InputJsonValue } });
  });
  await audit(trainingId, req.user!.id, 'TRAINING_GUIDE_DAY_CREATED');
  res.status(201).json({ data: day });
});
router.put('/:trainingId/guides/days/:dayId', async (req, res) => {
  const result = trainingDaySchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const trainingId = req.params.trainingId;
  const day = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    const existing = await tx.trainingDay.findFirst({ where: { id: req.params.dayId, liveTrainingId: trainingId } });
    if (!existing) throw new TrainingGuideError(404, 'Guide not found.');
    const conflict = await tx.trainingDay.findUnique({ where: { liveTrainingId_dayNumber: { liveTrainingId: trainingId, dayNumber: result.data.dayNumber } } });
    if (conflict && conflict.id !== existing.id) throw new TrainingGuideError(409, 'That day number is already in use. Use reorder to move days.');
    const itemIds = result.data.sections.flatMap((section) => section.items.map((item) => item.id));
    // Removed items no longer contribute to personal or class completion.
    await tx.trainingDayProgress.deleteMany({ where: { dayId: existing.id, itemId: { notIn: itemIds } } });
    if (existing.dayNumber !== result.data.dayNumber) {
      await tx.trainingGuideSettings.updateMany({ where: { liveTrainingId: trainingId, currentDayOverride: existing.dayNumber }, data: { currentDayOverride: result.data.dayNumber } });
      await tx.trainingGuideSettings.updateMany({ where: { liveTrainingId: trainingId, pausedDayNumber: existing.dayNumber }, data: { pausedDayNumber: result.data.dayNumber } });
      await tx.trainingGuideSource.updateMany({ where: { liveTrainingId: trainingId, dayNumber: existing.dayNumber }, data: { dayNumber: result.data.dayNumber } });
    }
    return tx.trainingDay.update({ where: { id: existing.id }, data: { ...result.data, sections: result.data.sections as Prisma.InputJsonValue } });
  });
  await audit(trainingId, req.user!.id, 'TRAINING_GUIDE_DAY_UPDATED');
  res.json({ data: day });
});
router.post('/:trainingId/guides/reorder', async (req, res) => {
  const result = z.object({ dayIds: z.array(z.string().uuid()).min(1).max(366) }).safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const trainingId = req.params.trainingId;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    const days = await tx.trainingDay.findMany({ where: { liveTrainingId: trainingId } });
    const ids = result.data.dayIds;
    if (ids.length !== days.length || new Set(ids).size !== ids.length || !days.every((day) => ids.includes(day.id))) throw new TrainingGuideError(400, 'Reorder must include every training day exactly once.');
    const settings = await tx.trainingGuideSettings.findUnique({ where: { liveTrainingId: trainingId } });
    await tx.trainingDay.updateMany({ where: { liveTrainingId: trainingId }, data: { dayNumber: { increment: 1000 } } });
    for (let index = 0; index < ids.length; index++) await tx.trainingDay.update({ where: { id: ids[index] }, data: { dayNumber: index + 1 } });
    const movedNumber = (number: number | null) => {
      const day = days.find((item) => item.dayNumber === number);
      return day ? ids.indexOf(day.id) + 1 : null;
    };
    if (settings) await tx.trainingGuideSettings.update({ where: { liveTrainingId: trainingId }, data: {
      currentDayOverride: movedNumber(settings.currentDayOverride), pausedDayNumber: movedNumber(settings.pausedDayNumber),
    } });
    // Keep day-scoped reference knowledge associated with the reordered day.
    const sources = await tx.trainingGuideSource.findMany({ where: { liveTrainingId: trainingId, dayNumber: { not: null } } });
    for (const source of sources) {
      const dayNumber = movedNumber(source.dayNumber);
      // An invalid legacy reference must never silently become global.
      if (dayNumber != null) await tx.trainingGuideSource.update({ where: { id: source.id }, data: { dayNumber } });
    }
  });
  await audit(trainingId, req.user!.id, 'TRAINING_GUIDE_DAYS_REORDERED');
  res.json({ data: { saved: true } });
});
router.post('/:trainingId/guides/import-vibe-coding', async (req, res) => {
  const data = await importVibeCodingGuides(req.params.trainingId);
  await audit(req.params.trainingId, req.user!.id, 'TRAINING_GUIDE_SYLLABUS_IMPORTED');
  res.status(201).json({ data });
});
router.post('/:trainingId/guides/sources', async (req, res) => {
  const result = guideSourceSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const trainingId = req.params.trainingId;
  const data = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    if (result.data.dayNumber != null && !await tx.trainingDay.findUnique({ where: { liveTrainingId_dayNumber: { liveTrainingId: trainingId, dayNumber: result.data.dayNumber } } })) throw new TrainingGuideError(400, 'Choose an existing day for this reference.');
    return tx.trainingGuideSource.create({ data: { ...result.data, liveTrainingId: trainingId } });
  });
  await audit(req.params.trainingId, req.user!.id, 'TRAINING_GUIDE_SOURCE_CREATED');
  res.status(201).json({ data });
});
router.put('/:trainingId/guides/sources/:sourceId', async (req, res) => {
  const result = guideSourceSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const trainingId = req.params.trainingId;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM live_trainings WHERE id = ${trainingId} FOR UPDATE`;
    if (result.data.dayNumber != null && !await tx.trainingDay.findUnique({ where: { liveTrainingId_dayNumber: { liveTrainingId: trainingId, dayNumber: result.data.dayNumber } } })) throw new TrainingGuideError(400, 'Choose an existing day for this reference.');
    return tx.trainingGuideSource.updateMany({ where: { id: req.params.sourceId, liveTrainingId: trainingId }, data: result.data });
  });
  if (!updated.count) return res.status(404).json({ message: 'Source not found.' });
  await audit(req.params.trainingId, req.user!.id, 'TRAINING_GUIDE_SOURCE_UPDATED');
  res.json({ data: { saved: true } });
});
export default router;
