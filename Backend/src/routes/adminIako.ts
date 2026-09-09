import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { iakoProfileSchema, iakoAssignmentSchema } from '../schemas/iakoSchemas';
import { uploadKnowledgeDocument, listKnowledgeSources, deleteKnowledgeSource, DocumentParseError } from '../services/iakoKnowledgeService';
import { isDigitalToolKey, DIGITAL_TOOLS } from '../config/digitalTools';
import { logAdminAction } from '../services/auditLogService';

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
    include: { assignments: { select: { liveTrainingId: true, digitalToolKey: true } } },
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
  const assignment = await prisma.iakoProfileAssignment.upsert({
    where: { liveTrainingId: training.id }, create: { liveTrainingId: training.id, profileId: profile.id }, update: { profileId: profile.id },
  });
  await logAdminAction({ action: 'IAKO_ASSIGNMENT_SET', targetType: 'LIVE_TRAINING', targetId: training.id, performedById: req.user!.id, metadata: { profileId: profile.id } });
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
    where: { digitalToolKey: req.params.toolKey }, create: { digitalToolKey: req.params.toolKey, profileId: profile.id }, update: { profileId: profile.id },
  });
  await logAdminAction({ action: 'IAKO_ASSIGNMENT_SET', targetType: 'DIGITAL_TOOL', targetId: req.params.toolKey, performedById: req.user!.id, metadata: { profileId: profile.id } });
  res.json({ data: assignment });
});

export default router;
