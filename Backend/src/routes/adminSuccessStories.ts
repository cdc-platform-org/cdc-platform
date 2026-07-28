import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { successStoryCreateSchema, successStoryUpdateSchema } from '../schemas/successStorySchemas';
import { uploadToBunnyStorage, isBunnyStorageConfigured, BunnyStorageUploadError, deleteBunnyStorageUrlIfManaged } from '../services/bunnyStorage';
import { logAdminAction } from '../services/auditLogService';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  const stories = await prisma.successStory.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: stories });
});

router.post('/', async (req: Request, res: Response) => {
  const result = successStoryCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { linkedinUrl, ...rest } = result.data;
  const story = await prisma.successStory.create({ data: { ...rest, linkedinUrl: linkedinUrl || null } });
  await logAdminAction({ action: 'success-story.create', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
  res.status(201).json({ data: story });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = successStoryUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { linkedinUrl, ...rest } = result.data;
  const story = await prisma.successStory
    .update({
      where: { id: req.params.id },
      data: { ...rest, ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl || null }) },
    })
    .catch(() => null);
  if (!story) return res.status(404).json({ message: 'Success story not found.' });

  await logAdminAction({ action: 'success-story.update', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
  res.json({ data: story });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const story = await prisma.successStory.delete({ where: { id: req.params.id } }).catch(() => null);
  if (!story) return res.status(404).json({ message: 'Success story not found.' });
  if (story.avatarUrl) deleteBunnyStorageUrlIfManaged(story.avatarUrl).catch(() => {});

  await logAdminAction({ action: 'success-story.delete', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
  res.status(204).send();
});

// --- Avatar upload: same buffered-straight-to-Bunny pattern as blog.ts's
// /upload-image, kept as its own endpoint (rather than reusing blog's)
// only so the storage folder stays distinct ("success-stories" vs "blog"). ---
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.post(
  '/upload-avatar',
  (req: Request, res: Response, next) => {
    if (!isBunnyStorageConfigured()) {
      return res.status(501).json({ message: 'Bunny Storage is not configured (BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_API_KEY / BUNNY_CDN_URL).' });
    }
    next();
  },
  avatarUpload.single('avatar'),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `success-story-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadToBunnyStorage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'success-stories',
        filename,
      });
      res.status(201).json({ url });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Avatar upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

export default router;
