import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { studioCaseCreateSchema, studioCaseUpdateSchema } from '../schemas/studioCaseSchemas';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { uploadImage, deleteManagedImage } from '../services/imageStorage';
import { logAdminAction } from '../services/auditLogService';
import { slugify, randomSlugSuffix } from '../utils/slugify';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Loops on a real unique-constraint collision rather than pre-checking
// existence — same shape as blog.ts's createUniqueSlug.
async function createUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'case';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
    const existing = await prisma.studioCaseStudy.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${base}-${randomSlugSuffix()}`;
}

router.get('/', async (req: Request, res: Response) => {
  const cases = await prisma.studioCaseStudy.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'desc' }] });
  res.json({ data: cases });
});

router.post('/', async (req: Request, res: Response) => {
  const result = studioCaseCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { coverImageUrl, projectUrl, videoUrl, fullStory, fullStoryEn, ...rest } = result.data;
  const slug = await createUniqueSlug(result.data.title);
  const caseStudy = await prisma.studioCaseStudy.create({
    data: {
      ...rest,
      slug,
      fullStory: fullStory || null,
      fullStoryEn: fullStoryEn || null,
      coverImageUrl: coverImageUrl || null,
      projectUrl: projectUrl || null,
      videoUrl: videoUrl || null,
    },
  });
  await logAdminAction({ action: 'studio-case.create', targetType: 'StudioCaseStudy', targetId: caseStudy.id, performedById: req.user!.id });
  res.status(201).json({ data: caseStudy });
});

router.put('/:id', async (req: Request, res: Response) => {
  const result = studioCaseUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { coverImageUrl, projectUrl, videoUrl, fullStory, fullStoryEn, galleryImages, ...rest } = result.data;
  try {
    // Read the pre-update coverImageUrl/galleryImages only when they're
    // actually changing, so a save that doesn't touch photos skips the
    // extra query — same pattern as adminSuccessStories.ts's PUT /:id.
    const previous =
      coverImageUrl !== undefined || galleryImages !== undefined
        ? await prisma.studioCaseStudy.findUnique({ where: { id: req.params.id }, select: { coverImageUrl: true, galleryImages: true } })
        : null;

    const caseStudy = await prisma.studioCaseStudy.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(fullStory !== undefined && { fullStory: fullStory || null }),
        ...(fullStoryEn !== undefined && { fullStoryEn: fullStoryEn || null }),
        ...(coverImageUrl !== undefined && { coverImageUrl: coverImageUrl || null }),
        ...(projectUrl !== undefined && { projectUrl: projectUrl || null }),
        ...(videoUrl !== undefined && { videoUrl: videoUrl || null }),
        ...(galleryImages !== undefined && { galleryImages }),
      },
    });

    if (previous?.coverImageUrl && previous.coverImageUrl !== (coverImageUrl || null)) {
      deleteManagedImage(previous.coverImageUrl).catch(() => {});
    }
    if (previous?.galleryImages && galleryImages !== undefined) {
      const removed = previous.galleryImages.filter((url) => !galleryImages.includes(url));
      removed.forEach((url) => deleteManagedImage(url).catch(() => {}));
    }

    await logAdminAction({ action: 'studio-case.update', targetType: 'StudioCaseStudy', targetId: caseStudy.id, performedById: req.user!.id });
    res.json({ data: caseStudy });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Case study not found.' });
    throw err;
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const caseStudy = await prisma.studioCaseStudy.delete({ where: { id: req.params.id } });
    if (caseStudy.coverImageUrl) deleteManagedImage(caseStudy.coverImageUrl).catch(() => {});
    caseStudy.galleryImages.forEach((url) => deleteManagedImage(url).catch(() => {}));

    await logAdminAction({ action: 'studio-case.delete', targetType: 'StudioCaseStudy', targetId: caseStudy.id, performedById: req.user!.id });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Case study not found.' });
    throw err;
  }
});

// --- Image upload: same buffered-straight-to-Bunny pattern as
// adminSuccessStories.ts's /upload-avatar. Used for both the single cover
// photo and each gallery screenshot — the client decides where the
// returned URL goes (coverImageUrl vs appending to galleryImages). ---
const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post(
  '/upload-image',
  (req: Request, res: Response, next) => {
    imageUpload.single('image')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The photo exceeds 10MB. Please choose a smaller file.' });
      }
      return res.status(400).json({ message: err.message || 'Only image uploads are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `studio-case-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'studio-cases',
        filename,
      });
      res.status(201).json({ url });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

export default router;
