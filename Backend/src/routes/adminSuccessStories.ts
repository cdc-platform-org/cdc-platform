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
import { slugify, randomSlugSuffix } from '../utils/slugify';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Loops on a real unique-constraint collision rather than pre-checking
// existence — same shape as adminStudioCases.ts's createUniqueSlug.
async function createUniqueSlug(studentName: string): Promise<string> {
  const base = slugify(studentName) || 'story';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
    const existing = await prisma.successStory.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${base}-${randomSlugSuffix()}`;
}

router.get('/', async (req: Request, res: Response) => {
  const stories = await prisma.successStory.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: stories });
});

router.post('/', async (req: Request, res: Response) => {
  const result = successStoryCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { linkedinUrl, portfolioUrl, avatarUrl, storyContent, storyContentEn, ...rest } = result.data;
  const slug = await createUniqueSlug(result.data.studentName);
  const story = await prisma.successStory.create({
    data: {
      ...rest,
      slug,
      linkedinUrl: linkedinUrl || null,
      portfolioUrl: portfolioUrl || null,
      avatarUrl: avatarUrl || null,
      storyContent: storyContent || null,
      storyContentEn: storyContentEn || null,
    },
  });
  await logAdminAction({ action: 'success-story.create', targetType: 'SuccessStory', targetId: story.id, performedById: req.user!.id });
  res.status(201).json({ data: story });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = successStoryUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { linkedinUrl, portfolioUrl, avatarUrl, storyContent, storyContentEn, galleryImages, ...rest } = result.data;
  try {
    // Read the pre-update avatarUrl/galleryImages only when they're
    // actually changing, so a save that doesn't touch photos skips the
    // extra query — same pattern as adminStudioCases.ts's PUT /:id.
    const previous =
      avatarUrl !== undefined || galleryImages !== undefined
        ? await prisma.successStory.findUnique({ where: { id: req.params.id }, select: { avatarUrl: true, galleryImages: true } })
        : null;

    const story = await prisma.successStory.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(linkedinUrl !== undefined && { linkedinUrl: linkedinUrl || null }),
        ...(portfolioUrl !== undefined && { portfolioUrl: portfolioUrl || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
        ...(storyContent !== undefined && { storyContent: storyContent || null }),
        ...(storyContentEn !== undefined && { storyContentEn: storyContentEn || null }),
        ...(galleryImages !== undefined && { galleryImages }),
      },
    });

    if (previous?.avatarUrl && previous.avatarUrl !== (avatarUrl || null)) {
      deleteManagedImage(previous.avatarUrl).catch(() => {});
    }
    if (previous?.galleryImages && galleryImages !== undefined) {
      const removed = previous.galleryImages.filter((url) => !galleryImages.includes(url));
      removed.forEach((url) => deleteManagedImage(url).catch(() => {}));
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
    story.galleryImages.forEach((url) => deleteManagedImage(url).catch(() => {}));

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

// --- Gallery image upload: same buffered-straight-to-Bunny pattern as the
// avatar upload above, kept as its own endpoint since it's a repeatable
// "add one more photo" action (client appends the returned URL to
// galleryImages) rather than the single-slot avatar. ---
router.post(
  '/upload-gallery-image',
  (req: Request, res: Response, next) => {
    avatarUpload.single('image')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `success-story-gallery-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'success-stories',
        filename,
      });
      res.status(201).json({ url });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Photo upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

export default router;
