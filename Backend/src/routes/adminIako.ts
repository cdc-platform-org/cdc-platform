import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { iakoProfileSchema, iakoAssignmentSchema, iakoUsageGrantPatchSchema, iakoAddRequestsSchema, accessGrantResourceType } from '../schemas/iakoSchemas';
import { uploadKnowledgeDocument, listKnowledgeSources, deleteKnowledgeSource, DocumentParseError } from '../services/iakoKnowledgeService';
import { isDigitalToolKey, DIGITAL_TOOLS } from '../config/digitalTools';
import { logAdminAction } from '../services/auditLogService';
import { usageSummary, adminUpdateUsageGrant, adminAddRequests, adminRevokeUsageGrant, adminReactivateUsageGrant, adminResetUsage, IakoGrantAdminError } from '../services/iakoUsageGrantService';

const router = Router();
router.use(authenticate, requireNotBannedOrDeleted, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (/\.(pdf|docx|md|txt)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, or Markdown (.md) files are allowed.'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.get('/tools', (req: Request, res: Response) => {
  res.json({ data: DIGITAL_TOOLS });
});

router.get('/profiles', async (req: Request, res: Response) => {
  const profiles = await prisma.iakoAssistantProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: { assignments: { select: {
      liveTrainingId: true, digitalToolKey: true, mode: true,
      initialRequestLimit: true, autoTopUpEnabled: true, autoTopUpAmount: true, maxAutoTopUps: true, maxAutoTotal: true,
    } } },
  });
  res.json({ data: profiles });
});

router.get('/profiles/:id', async (req: Request, res: Response) => {
  const profile = await prisma.iakoAssistantProfile.findUnique({
    where: { id: req.params.id }, include: { assignments: true },
  });
  if (!profile) return res.status(404).json({ message: 'Profile not found.' });
  const sources = await listKnowledgeSources(profile.id);
  res.json({ data: { ...profile, sources } });
});

router.post('/profiles', async (req: Request, res: Response) => {
  const result = iakoProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const profile = await prisma.iakoAssistantProfile.create({ data: { ...result.data, createdById: req.user!.id } });
  await logAdminAction({ action: 'IAKO_PROFILE_CREATED', targetType: 'IAKO_PROFILE', targetId: profile.id, performedById: req.user!.id });
  res.status(201).json({ data: profile });
});

router.put('/profiles/:id', async (req: Request, res: Response) => {
  const result = iakoProfileSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const existing = await prisma.iakoAssistantProfile.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Profile not found.' });
  const profile = await prisma.iakoAssistantProfile.update({ where: { id: req.params.id }, data: result.data });
  await logAdminAction({ action: 'IAKO_PROFILE_UPDATED', targetType: 'IAKO_PROFILE', targetId: profile.id, performedById: req.user!.id });
  res.json({ data: profile });
});

router.post(
  '/profiles/:id/knowledge',
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File exceeds the 20MB limit.' });
      return res.status(400).json({ message: err.message || 'Only PDF, DOCX, or Markdown (.md) files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    const profile = await prisma.iakoAssistantProfile.findUnique({ where: { id: req.params.id } });
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      const rows = await uploadKnowledgeDocument(profile.id, { buffer: req.file.buffer, mimetype: req.file.mimetype, originalname: req.file.originalname });
      await logAdminAction({ action: 'IAKO_KNOWLEDGE_UPLOADED', targetType: 'IAKO_PROFILE', targetId: profile.id, performedById: req.user!.id, metadata: { filename: req.file.originalname } });
      res.status(201).json({ data: { sourceFilename: req.file.originalname, totalChunks: rows.length } });
    } catch (err) {
      const message = err instanceof DocumentParseError ? err.message : 'Failed to parse this document.';
      res.status(400).json({ message });
    }
  }
);

router.delete('/profiles/:id/knowledge/:filename', async (req: Request, res: Response) => {
  const { count } = await deleteKnowledgeSource(req.params.id, decodeURIComponent(req.params.filename));
  if (!count) return res.status(404).json({ message: 'No document found with that filename.' });
  await logAdminAction({ action: 'IAKO_KNOWLEDGE_DELETED', targetType: 'IAKO_PROFILE', targetId: req.params.id, performedById: req.user!.id, metadata: { filename: req.params.filename } });
  res.status(204).send();
});

// Builds the partial write for the 5 auto-top-up fields, omitting anything
// the caller didn't send — same "don't silently reset what wasn't sent"
// convention as `mode` above, since a simpler caller (e.g. the Daily
// Guides page's profile-only assignment call) must never wipe out an
// already-configured top-up policy.
function topUpAssignmentFields(data: z.infer<typeof iakoAssignmentSchema>) {
  return {
    ...(data.initialRequestLimit !== undefined ? { initialRequestLimit: data.initialRequestLimit } : {}),
    ...(data.autoTopUpEnabled !== undefined ? { autoTopUpEnabled: data.autoTopUpEnabled } : {}),
    ...(data.autoTopUpAmount !== undefined ? { autoTopUpAmount: data.autoTopUpAmount } : {}),
    ...(data.maxAutoTopUps !== undefined ? { maxAutoTopUps: data.maxAutoTopUps } : {}),
    ...(data.maxAutoTotal !== undefined ? { maxAutoTotal: data.maxAutoTotal } : {}),
  };
}

// Assign (or unassign, with profileId: null) a profile to a LiveTraining.
router.put('/assignments/live-training/:liveTrainingId', async (req: Request, res: Response) => {
  const result = iakoAssignmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const training = await prisma.liveTraining.findUnique({ where: { id: req.params.liveTrainingId }, select: { id: true } });
  if (!training) return res.status(404).json({ message: 'Live training not found.' });
  if (result.data.profileId === null) {
    await prisma.iakoProfileAssignment.deleteMany({ where: { liveTrainingId: training.id } });
    await logAdminAction({ action: 'IAKO_ASSIGNMENT_REMOVED', targetType: 'LIVE_TRAINING', targetId: training.id, performedById: req.user!.id });
    return res.json({ data: { saved: true } });
  }
  const profile = await prisma.iakoAssistantProfile.findUnique({ where: { id: result.data.profileId } });
  if (!profile) return res.status(400).json({ message: 'Choose an existing profile.' });

  // Validated against the post-write effective values (incoming field if
  // present, otherwise whatever's already configured) — same posture as
  // adminLiveTrainings.ts's own discount validation — so a caller that
  // only ever sends one top-up field can never leave the policy in a state
  // where the ceiling is below the starting total.
  const existingAssignment = await prisma.iakoProfileAssignment.findUnique({ where: { liveTrainingId: training.id } });
  const effectiveInitial = (result.data.initialRequestLimit !== undefined ? result.data.initialRequestLimit : existingAssignment?.initialRequestLimit ?? null) ?? profile.defaultRequestLimit;
  const effectiveAutoTopUpEnabled = result.data.autoTopUpEnabled !== undefined ? result.data.autoTopUpEnabled : existingAssignment?.autoTopUpEnabled ?? false;
  const effectiveMaxAutoTotal = result.data.maxAutoTotal !== undefined ? result.data.maxAutoTotal : existingAssignment?.maxAutoTotal ?? null;
  if (effectiveAutoTopUpEnabled && effectiveInitial != null && effectiveMaxAutoTotal != null && effectiveMaxAutoTotal < effectiveInitial) {
    return res.status(400).json({ message: 'Maximum automatic total cannot be less than the starting total.' });
  }
  // mode omitted => leave an existing assignment's mode untouched, or let a
  // brand-new one fall back to the schema default (LIVE) — see
  // IakoProfileAssignment.mode's own comment for why a caller that doesn't
  // know about modes yet (e.g. the Daily Guides page, until it's updated)
  // must never silently flip an assignment's access mode. Same convention
  // now extends to the 5 auto-top-up fields — see topUpAssignmentFields.
  const assignment = await prisma.iakoProfileAssignment.upsert({
    where: { liveTrainingId: training.id },
    create: { liveTrainingId: training.id, profileId: profile.id, ...(result.data.mode ? { mode: result.data.mode } : {}), ...topUpAssignmentFields(result.data) },
    update: { profileId: profile.id, ...(result.data.mode ? { mode: result.data.mode } : {}), ...topUpAssignmentFields(result.data) },
  });
  await logAdminAction({ action: 'IAKO_ASSIGNMENT_SET', targetType: 'LIVE_TRAINING', targetId: training.id, performedById: req.user!.id, metadata: { profileId: profile.id, mode: assignment.mode } });
  res.json({ data: assignment });
});

// Assign (or unassign) a profile to a Digital Tool key.
router.put('/assignments/digital-tool/:toolKey', async (req: Request, res: Response) => {
  const result = iakoAssignmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  if (!isDigitalToolKey(req.params.toolKey)) return res.status(404).json({ message: 'Unknown Digital Tool.' });
  if (result.data.profileId === null) {
    await prisma.iakoProfileAssignment.deleteMany({ where: { digitalToolKey: req.params.toolKey } });
    await logAdminAction({ action: 'IAKO_ASSIGNMENT_REMOVED', targetType: 'DIGITAL_TOOL', targetId: req.params.toolKey, performedById: req.user!.id });
    return res.json({ data: { saved: true } });
  }
  const profile = await prisma.iakoAssistantProfile.findUnique({ where: { id: result.data.profileId } });
  if (!profile) return res.status(400).json({ message: 'Choose an existing profile.' });
  const assignment = await prisma.iakoProfileAssignment.upsert({
    where: { digitalToolKey: req.params.toolKey },
    create: { digitalToolKey: req.params.toolKey, profileId: profile.id, ...topUpAssignmentFields(result.data) },
    update: { profileId: profile.id, ...topUpAssignmentFields(result.data) },
  });
  await logAdminAction({ action: 'IAKO_ASSIGNMENT_SET', targetType: 'DIGITAL_TOOL', targetId: req.params.toolKey, performedById: req.user!.id, metadata: { profileId: profile.id } });
  res.json({ data: assignment });
});

// Usage grants — item 13's admin management surface: every learner's IAKO
// quota for a resource, with the same X/Y counts checkUsageQuota itself
// enforces (see iakoUsageGrantService.ts's usageSummary), plus the actions
// to adjust them without touching the database by hand.
router.get('/usage-grants', async (req: Request, res: Response) => {
  const resourceTypeResult = accessGrantResourceType.safeParse(req.query.resourceType);
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId : undefined;
  const grants = await prisma.iakoUsageGrant.findMany({
    where: { ...(resourceTypeResult.success ? { resourceType: resourceTypeResult.data } : {}), ...(resourceId ? { resourceId } : {}) },
    include: { user: { select: { id: true, name: true, email: true } }, profile: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const liveTrainingIds = grants.filter((grant) => grant.resourceType === 'LIVE_TRAINING').map((grant) => grant.resourceId);
  const digitalToolKeys = grants.filter((grant) => grant.resourceType === 'DIGITAL_TOOL').map((grant) => grant.resourceId);
  const [trainings, assignments] = await Promise.all([
    liveTrainingIds.length ? prisma.liveTraining.findMany({ where: { id: { in: liveTrainingIds } }, select: { id: true, title: true } }) : Promise.resolve([]),
    prisma.iakoProfileAssignment.findMany({
      where: { OR: [{ liveTrainingId: { in: liveTrainingIds } }, { digitalToolKey: { in: digitalToolKeys } }] },
      select: { liveTrainingId: true, digitalToolKey: true, autoTopUpEnabled: true, autoTopUpAmount: true, maxAutoTopUps: true, maxAutoTotal: true },
    }),
  ]);
  const trainingTitleById = new Map(trainings.map((training) => [training.id, training.title]));
  const assignmentByResourceId = new Map(assignments.map((assignment) => [assignment.liveTrainingId ?? assignment.digitalToolKey, assignment]));

  // Lets the admin table show "Auto top-up available: +N" (below the
  // ceiling, a top-up hasn't fired yet but could) vs. "Auto top-up applied"
  // (already used at least once) vs. nothing (disabled for this resource).
  const data = await Promise.all(grants.map(async (grant) => {
    const assignment = assignmentByResourceId.get(grant.resourceId);
    const usage = await usageSummary(grant);
    const topUpPolicy = assignment?.autoTopUpEnabled ? {
      amount: assignment.autoTopUpAmount, maxTopUps: assignment.maxAutoTopUps, maxTotal: assignment.maxAutoTotal,
      available: usage.autoTopUpsApplied < assignment.maxAutoTopUps,
    } : null;
    return {
      id: grant.id, user: grant.user, profile: grant.profile, resourceType: grant.resourceType, resourceId: grant.resourceId,
      resourceTitle: grant.resourceType === 'LIVE_TRAINING' ? (trainingTitleById.get(grant.resourceId) ?? grant.resourceId) : (DIGITAL_TOOLS.find((tool) => tool.key === grant.resourceId)?.label ?? grant.resourceId),
      usage, topUpPolicy,
    };
  }));
  res.json({ data });
});

router.patch('/usage-grants/:id', async (req: Request, res: Response) => {
  const result = iakoUsageGrantPatchSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const grant = await adminUpdateUsageGrant(req.params.id, result.data);
    await logAdminAction({ action: 'IAKO_USAGE_GRANT_UPDATED', targetType: 'IAKO_USAGE_GRANT', targetId: grant.id, performedById: req.user!.id, metadata: result.data });
    res.json({ data: { ...grant, usage: await usageSummary(grant) } });
  } catch (err) {
    if (err instanceof IakoGrantAdminError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/usage-grants/:id/add-requests', async (req: Request, res: Response) => {
  const result = iakoAddRequestsSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const grant = await adminAddRequests(req.params.id, result.data.amount);
    await logAdminAction({ action: 'IAKO_USAGE_GRANT_REQUESTS_ADDED', targetType: 'IAKO_USAGE_GRANT', targetId: grant.id, performedById: req.user!.id, metadata: { amount: result.data.amount } });
    res.json({ data: { ...grant, usage: await usageSummary(grant) } });
  } catch (err) {
    if (err instanceof IakoGrantAdminError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/usage-grants/:id/revoke', async (req: Request, res: Response) => {
  try {
    const grant = await adminRevokeUsageGrant(req.params.id);
    await logAdminAction({ action: 'IAKO_USAGE_GRANT_REVOKED', targetType: 'IAKO_USAGE_GRANT', targetId: grant.id, performedById: req.user!.id });
    res.json({ data: { ...grant, usage: await usageSummary(grant) } });
  } catch (err) {
    if (err instanceof IakoGrantAdminError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/usage-grants/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const grant = await adminReactivateUsageGrant(req.params.id);
    await logAdminAction({ action: 'IAKO_USAGE_GRANT_REACTIVATED', targetType: 'IAKO_USAGE_GRANT', targetId: grant.id, performedById: req.user!.id });
    res.json({ data: { ...grant, usage: await usageSummary(grant) } });
  } catch (err) {
    if (err instanceof IakoGrantAdminError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

router.post('/usage-grants/:id/reset-usage', async (req: Request, res: Response) => {
  try {
    const grant = await adminResetUsage(req.params.id);
    await logAdminAction({ action: 'IAKO_USAGE_GRANT_USAGE_RESET', targetType: 'IAKO_USAGE_GRANT', targetId: grant.id, performedById: req.user!.id });
    res.json({ data: { ...grant, usage: await usageSummary(grant) } });
  } catch (err) {
    if (err instanceof IakoGrantAdminError) return res.status(err.status).json({ message: err.message });
    throw err;
  }
});

export default router;
