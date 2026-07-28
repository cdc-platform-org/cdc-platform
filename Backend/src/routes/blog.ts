import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { blogPostCreateSchema, blogPostUpdateSchema } from '../schemas/blogSchemas';
import { uploadToBunnyStorage, isBunnyStorageConfigured, BunnyStorageUploadError, deleteBunnyStorageUrlIfManaged } from '../services/bunnyStorage';

// Migrated from requireRole('SuperAdmin') to the admin-team adminRole system
// (SUPER_ADMIN + ADMIN) — content management is explicitly ADMIN's domain
// per the /admin panel's RBAC design, and this file's small/self-contained
// enough that migrating it doesn't carry the risk a wider sweep would.
const router = Router();
const authorSelect = { select: { id: true, name: true, role: true } };

router.get('/', async (req: Request, res: Response) => {
  const { category } = req.query;
  const posts = await prisma.blogPost.findMany({
    where: category ? { category: String(category) } : undefined,
    include: { author: authorSelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: posts });
});

router.get('/:id', async (req: Request, res: Response) => {
  const post = await prisma.blogPost.findUnique({
    where: { id: req.params.id },
    include: { author: authorSelect },
  });
  if (!post) {
    return res.status(404).json({ message: 'Blog post not found.' });
  }
  res.json({ data: post });
});

router.post('/', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = blogPostCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  const post = await prisma.blogPost.create({
    data: {
      ...result.data,
      imageUrl: result.data.imageUrl || null,
      authorId: req.user!.id,
    },
    include: { author: authorSelect },
  });
  res.status(201).json({ data: post });
});

router.put('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = blogPostUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }
  const nextImageUrl = result.data.imageUrl !== undefined ? result.data.imageUrl || null : undefined;
  try {
    // Read the pre-update imageUrl only when it's actually changing, so a
    // save that doesn't touch the image skips the extra query entirely.
    const previous =
      nextImageUrl !== undefined
        ? await prisma.blogPost.findUnique({ where: { id: req.params.id }, select: { imageUrl: true } })
        : null;

    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        ...result.data,
        imageUrl: nextImageUrl,
      },
      include: { author: authorSelect },
    });

    if (previous && previous.imageUrl && previous.imageUrl !== nextImageUrl) {
      // Fire-and-forget — the response shouldn't wait on Bunny, and a
      // failed cleanup just leaves harmless orphaned storage debris.
      deleteBunnyStorageUrlIfManaged(previous.imageUrl).catch(() => {});
    }

    res.json({ data: post });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Blog post not found.' });
    }
    throw err;
  }
});

router.delete('/:id', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.blogPost.delete({ where: { id: req.params.id }, select: { imageUrl: true } });
    if (deleted.imageUrl) {
      deleteBunnyStorageUrlIfManaged(deleted.imageUrl).catch(() => {});
    }
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Blog post not found.' });
    }
    throw err;
  }
});

// --- Image upload: buffered in memory, then pushed straight to Bunny
// Storage — nothing ever touches this server's disk. Reused by both the
// blog editor and the CMS image pickers (homepage HEKS card, gallery). ---
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('მხოლოდ სურათის ატვირთვაა ნებადართული!'));
  }
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

router.post(
  '/upload-image',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  (req: Request, res: Response, next) => {
    if (!isBunnyStorageConfigured()) {
      return res.status(501).json({ message: 'Bunny Storage is not configured (BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_API_KEY / BUNNY_CDN_URL).' });
    }
    next();
  },
  imageUpload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'ფაილი არ არის არჩეული' });
    }
    const filename = `blog-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadToBunnyStorage({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folderName: 'blog',
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
