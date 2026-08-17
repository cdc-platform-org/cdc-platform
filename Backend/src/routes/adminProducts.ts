import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdminRole } from '../middleware/auth';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { imageUpload, fileUpload, multerErrorHandler } from '../middleware/productUploads';

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'));

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
  // Up to 4 additional showcase screenshots alongside imageUrl (the main
  // cover) — empty is fine, a submission isn't required to have a gallery.
  previewImages: z.array(z.string().url()).max(4).optional().default([]),
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

// Every purchase of one product, including whether the buyer has ever
// actually downloaded the file — the deciding fact for a refund request
// (products.ts's refund policy: non-refundable once downloaded).
router.get('/:id/purchases', async (req: Request, res: Response) => {
  const purchases = await prisma.productPurchase.findMany({
    where: { productId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: purchases });
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: z.string().min(1).max(100).optional(),
  // Major-unit GEL, same conversion as createSchema — omit to leave price unchanged.
  price: z.number().min(0).optional(),
  imageUrl: z.string().url().optional(),
  previewImages: z.array(z.string().url()).max(4).optional(),
});

// Lets an admin fix typos/formatting on a graduate/freelancer submission
// (or an admin-authored product) before approving it — separate from
// approve/reject so an admin can save edits without also deciding the
// status in the same request.
router.put('/:id', async (req: Request, res: Response) => {
  const result = updateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  try {
    const { price, ...rest } = result.data;
    const updated = await prisma.digitalProduct.update({
      where: { id: req.params.id },
      data: { ...rest, ...(price !== undefined ? { price: Math.round(price * 100) } : {}) },
    });
    res.json({ data: updated });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Product not found.' });
    throw err;
  }
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

const requestChangesSchema = z.object({
  feedback: z.string().min(1).max(1000),
});

// Distinct from REJECT — REJECTED is a final decision, NEEDS_REVISION tells
// the submitter exactly what to fix and lets them edit + resubmit (see
// products.ts's PUT /:id/mine, which resets status back to PENDING on
// save). Reuses the rejectionReason column to hold the feedback text — same
// "why this needs attention" purpose in both states, not worth a second
// column for.
router.post('/:id/request-changes', async (req: Request, res: Response) => {
  const result = requestChangesSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const updated = await prisma.digitalProduct.update({
    where: { id: product.id },
    data: { status: 'NEEDS_REVISION', rejectionReason: result.data.feedback },
  });

  if (product.submittedById) {
    await prisma.notification.create({
      data: {
        userId: product.submittedById,
        title: 'თქვენი პროდუქტი საჭიროებს ცვლილებებს',
        message: `„${product.title}": ${result.data.feedback}`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.json({ data: updated });
});

export default router;
