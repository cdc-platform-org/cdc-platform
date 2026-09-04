import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { logAdminAction } from '../services/auditLogService';
import { uploadImage } from '../services/imageStorage';
import { callTextModel, AiAgentError, isAiAgentConfigured, InlineImagePart } from '../services/aiAgentService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

const photosUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 15 },
});

// ============================================================
// AI VISION BUILDER — admin uploads raw event photos + freeform notes; this
// extracts a structured draft (title/date/location/summary/full write-up)
// for the admin to review and edit before actually saving a Project (see
// POST / below — this endpoint never writes to the database itself).
//
// Photos are uploaded to storage FIRST, before the AI call — so the
// preview step always has real, usable URLs even if the AI call itself
// fails (returned alongside the error), and a slow AI response never risks
// losing an upload the admin already waited through.
// ============================================================
router.post('/ai-builder/parse', photosUpload.array('photos', 15), async (req: Request, res: Response) => {
  if (!isAiAgentConfigured()) return res.status(501).json({ message: 'AI parsing is not configured (GEMINI_API_KEY/AZURE_OPENAI_* missing).' });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return res.status(400).json({ message: 'Upload at least one photo.' });
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';

  const imageUrls: string[] = [];
  for (const file of files) {
    const filename = `project-${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname) || '.jpg'}`;
    const url = await uploadImage({ buffer: file.buffer, mimetype: file.mimetype, folderName: 'projects', filename });
    imageUrls.push(url);
  }

  const imageParts: InlineImagePart[] = files.map((f) => ({ mimeType: f.mimetype, data: f.buffer.toString('base64') }));

  const prompt = `You are helping CDC (a Georgian digital-careers/education center) publish a past event/project to their public showcase, from a set of photos and the admin's own raw notes.

Admin's notes (may be messy, incomplete, or in Georgian/English — use them as the primary source of truth for facts you can't read directly from the photos):
"""
${notes || '(no notes provided — infer everything from the photos alone)'}
"""

Look at the attached photo(s) and the notes together and produce:
1. title: a short, specific event/project title (write it in Georgian if the notes are in Georgian, otherwise English).
2. date: your best-guess date for this event in strict ISO 8601 format (YYYY-MM-DD). If no date is stated or visible anywhere, use today's date: ${new Date().toISOString().slice(0, 10)}.
3. location: where this took place, if stated or reasonably inferable — null if genuinely unknown, never fabricated.
4. shortDescription: a 1-2 sentence summary (under 200 characters) suitable for a showcase card preview.
5. fullContent: a well-structured 3-6 paragraph write-up of the event/project as clean HTML (<p> tags only, no <html>/<body> wrapper, no headings needed) — informative and specific, grounded in the notes and what the photos actually show, never generic filler.

Respond with strict JSON matching this shape:
{"title": string, "date": string, "location": string | null, "shortDescription": string, "fullContent": string}`;

  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.5, imageParts);
  } catch (err) {
    const message = err instanceof AiAgentError ? err.message : 'AI parsing failed.';
    const status = err instanceof AiAgentError ? err.status : 502;
    // Photos are already uploaded — returned even on AI failure so the
    // admin can still fill the form in by hand instead of re-uploading.
    return res.status(status).json({ message, data: { coverImage: imageUrls[0] ?? null, galleryImages: imageUrls.slice(1) } });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return res.status(502).json({ message: 'AI returned malformed data.', data: { coverImage: imageUrls[0] ?? null, galleryImages: imageUrls.slice(1) } });
  }

  const draftSchema = z.object({
    title: z.string().min(1),
    date: z.string().min(1),
    location: z.string().nullable(),
    shortDescription: z.string().min(1),
    fullContent: z.string().min(1),
  });
  const result = draftSchema.safeParse(parsed);
  if (!result.success) {
    return res.status(502).json({ message: 'AI returned an unexpected format.', data: { coverImage: imageUrls[0] ?? null, galleryImages: imageUrls.slice(1) } });
  }

  res.json({
    data: {
      ...result.data,
      coverImage: imageUrls[0],
      galleryImages: imageUrls.slice(1),
    },
  });
});

// ============================================================
// CRUD — the admin reviews/edits the AI Builder's draft (or writes one by
// hand) and this is what actually persists it. galleryImages/coverImage are
// plain uploaded-storage URLs, never re-validated against the AI step —
// the admin can freely reorder/remove photos before saving.
// ============================================================
const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.string().min(1),
  location: z.string().trim().max(200).optional().nullable(),
  shortDescription: z.string().trim().min(1).max(500),
  fullContent: z.string().trim().min(1),
  coverImage: z.string().url(),
  galleryImages: z.array(z.string().url()).default([]),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

router.get('/', async (_req: Request, res: Response) => {
  const projects = await prisma.project.findMany({ orderBy: { date: 'desc' } });
  res.json({ data: projects });
});

router.get('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  res.json({ data: project });
});

router.post('/', async (req: Request, res: Response) => {
  const result = projectSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { date, ...rest } = result.data;
  const project = await prisma.project.create({
    data: { ...rest, date: new Date(date), createdById: req.user!.id },
  });
  await logAdminAction({ action: 'project.create', targetType: 'Project', targetId: project.id, performedById: req.user!.id });
  res.status(201).json({ data: project });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = projectSchema.partial().safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { date, ...rest } = result.data;
  const project = await prisma.project
    .update({
      where: { id: req.params.id },
      data: { ...rest, ...(date !== undefined ? { date: new Date(date) } : {}) },
    })
    .catch(() => null);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  await logAdminAction({ action: 'project.update', targetType: 'Project', targetId: project.id, performedById: req.user!.id });
  res.json({ data: project });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const project = await prisma.project.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!project) return res.status(404).json({ message: 'Project not found.' });
  await logAdminAction({ action: 'project.delete', targetType: 'Project', targetId: project.id, performedById: req.user!.id });
  res.status(204).send();
});

export default router;
