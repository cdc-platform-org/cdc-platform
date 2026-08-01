import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { successStoryCreateSchema, successStoryUpdateSchema } from '../schemas/successStorySchemas';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { uploadImage, deleteManagedImage } from '../services/imageStorage';
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

  const { linkedinUrl, avatarUrl, ...rest } = result.data;
  const story = await prisma.successStory.create({
    data: { ...rest, linkedinUrl: linkedinUrl || null, avatarUrl: avatarUrl || null },
  });
  await logAdminAction({ action: 'success-story.create', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
  res.status(201).json({ data: story });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = successStoryUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { linkedinUrl, avatarUrl, ...rest } = result.data;
  try {
    // Read the pre-update avatarUrl only when it's actually changing, so a
    // save that doesn't touch the photo skips the extra query entirely —
    // same pattern as blog.ts's PUT /:id.
    const previous =
      avatarUrl !== undefined
        ? await prisma.successStory.findUnique({ where: { id: req.params.id }, select: { avatarUrl: true } })
        : null;

    const story = await prisma.successStory.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      },
    });

    if (previous && previous.avatarUrl && previous.avatarUrl !== (avatarUrl || null)) {
      deleteManagedImage(previous.avatarUrl).catch(() => {});
    }

    await logAdminAction({ action: 'success-story.update', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
    res.json({ data: story });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Success story not found.' });
    throw err;
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const story = await prisma.successStory.delete({ where: { id: req.params.id } });
    if (story.avatarUrl) deleteManagedImage(story.avatarUrl).catch(() => {});

    await logAdminAction({ action: 'success-story.delete', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Success story not found.' });
    throw err;
  }
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/upload-avatar',
  (req: Request, res: Response, next) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `success-story-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
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
