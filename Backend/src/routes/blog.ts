import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { blogPostCreateSchema, blogPostUpdateSchema } from '../schemas/blogSchemas';

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
  try {
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        ...result.data,
        imageUrl: result.data.imageUrl !== undefined ? result.data.imageUrl || null : undefined,
      },
      include: { author: authorSelect },
    });
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
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Blog post not found.' });
    }
    throw err;
  }
});

// --- Image upload: stores locally under Backend/public/uploads, served at /uploads/<file>. ---
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('მხოლოდ სურათის ატვირთვაა ნებადართული!'));
  }
};

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
    filename: (req, file, cb) => {
      cb(null, `blog-${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

router.post(
  '/upload-image',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  imageUpload.single('image'),
  (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'ფაილი არ არის არჩეული' });
    }
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  }
);

export default router;
