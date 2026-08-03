import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

// Preview image — same 10MB/image-only guard as course thumbnails/avatars.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Downloadable asset (UI kit, prompt pack, e-book, etc.) — broader allowlist
// than images, no code/executable formats. NOTE: like the rest of this
// codebase's Bunny-Storage-backed uploads, this returns a plain public CDN
// URL — access control for buyers-only is enforced at the API layer
// (products.ts's /:id/download only reveals fileUrl to a verified
// purchaser), not by the storage URL itself being unguessable.
const ALLOWED_FILE_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/pdf',
  'application/epub+zip',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
];
const fileUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype) || /\.(zip|pdf|epub|rar|7z|fig|sketch)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP, PDF, EPUB, RAR, 7Z, FIG, or SKETCH files are allowed.'));
    }
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB — product assets, not video
});

function multerErrorHandler(req: Request, res: Response, err: any, next: NextFunction) {
  if (!err) return next();
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File is too large.' });
  }
  return res.status(400).json({ message: err.message || 'Upload rejected.' });
}

router.post(
  '/upload-image',
  (req: Request, res: Response, next: NextFunction) => imageUpload.single('image')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `product-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'product-images', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post(
  '/upload-file',
  (req: Request, res: Response, next: NextFunction) => fileUpload.single('file')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `product-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'product-files', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'File upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  // Major-unit GEL from the admin form — converted to minor units (tetri)
  // here so every other money field in the DB (Course.originalPrice,
  // BogPayment.amount) stays in the same unit.
  price: z.number().min(0),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  fileUrl: z.string().url(),
});

// Admin-authored products skip moderation — there's no point an admin
// approving their own submission — unlike products.ts's graduate-facing
// POST /, which always lands PENDING.
router.post('/', async (req: Request, res: Response) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.create({
    data: { ...result.data, price: Math.round(result.data.price * 100), status: 'APPROVED' },
  });
  res.status(201).json({ data: product });
});

// Full list across every status — the public GET /api/products only ever
// shows APPROVED, so the moderation queue needs its own view.
router.get('/', async (_req: Request, res: Response) => {
  const products = await prisma.digitalProduct.findMany({
    orderBy: { createdAt: 'desc' },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });
  res.json({ data: products });
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const updated = await prisma.digitalProduct.update({
    where: { id: product.id },
    data: { status: 'APPROVED', rejectionReason: null },
  });

  if (product.submittedById) {
    await prisma.notification.create({
      data: {
        userId: product.submittedById,
        title: 'თქვენი პროდუქტი დამტკიცდა',
        message: `„${product.title}" გამოქვეყნდა ციფრულ მაღაზიაში.`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.json({ data: updated });
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  const result = rejectSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const updated = await prisma.digitalProduct.update({
    where: { id: product.id },
    data: { status: 'REJECTED', rejectionReason: result.data.reason },
  });

  if (product.submittedById) {
    await prisma.notification.create({
      data: {
        userId: product.submittedById,
        title: 'თქვენი პროდუქტი უარყოფილია',
        message: `„${product.title}": ${result.data.reason}`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.json({ data: updated });
});

export default router;
