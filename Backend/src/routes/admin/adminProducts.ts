/**
 * Express router mounted at `/api/admin/products` (see server.ts).
 * Endpoints:
 *   POST /upload-image
 *   POST /upload-video
 *   POST /upload-file
 *   POST /
 *   POST /file-link
 *   GET /
 *   GET /:id/purchases
 *   PUT /:id
 *   POST /:id/approve
 *   POST /:id/reject
 *   POST /:id/request-changes
 *   POST /:id/archive
 *   POST /:id/restore
 */
import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { ProductLicenseType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import { hideMoneyFromNonSuperAdmin } from '../../middleware/moneyVisibility';
import { uploadImage } from '../../services/integrations/imageStorage';
import { BunnyStorageUploadError } from '../../services/integrations/bunnyStorage';
import { imageUpload, fileUpload, videoUpload, multerErrorHandler } from '../../middleware/productUploads';
import { autoTranslateIfBlank } from '../../services/ai/aiTranslateService';
import { protectProductPreviewImage } from '../../services/marketplace/productImageProtection';
import { uploadProductFile, resolveProductFileDeliveryUrl } from '../../services/marketplace/productFileDelivery';
import { withCurrentProductPrice, validateProductDiscount } from '../../services/marketplace/productPricing';
import { logAdminAction } from '../../services/account/auditLogService';

function toPrismaSaleEndsAt(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return new Date(value);
}

// A scheduled sale must end after it starts — otherwise it would silently
// never be live. Either side may be blank (open-ended).
function validateSaleWindow(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  if (new Date(end).getTime() <= new Date(start).getTime()) return 'Sale end date must be after the start date.';
  return null;
}

// Prisma's Json? columns need the explicit Prisma.JsonNull sentinel to set
// SQL NULL — a plain `null` is ambiguous (it could mean "the JSON value
// null" or "no value") and Prisma rejects it at the type level for exactly
// that reason. `undefined` (field omitted from the request) still means
// "leave this column untouched", same as every other optional field here.
function toPrismaJson<T>(value: T | null | undefined): T | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  return value === null ? Prisma.JsonNull : value;
}

// Icons the "How it Works" panel (pages/store/[id].tsx) actually has a
// lookup for — kept as a closed enum rather than a free-text icon name so a
// typo can't silently render nothing on the storefront.
const HOW_IT_WORKS_ICONS = [
  'Download', 'FolderOpen', 'Sparkles', 'Zap', 'Upload', 'Code2', 'ShieldCheck', 'Tag',
] as const;

// Exactly 3 steps or omit entirely — a partial override (1 or 2 steps) has
// no sensible rendering, so it's rejected here rather than left for the
// frontend to guess how to fill the gap.
const howItWorksStepsSchema = z
  .array(
    z.object({
      icon: z.enum(HOW_IT_WORKS_ICONS),
      titleKa: z.string().trim().min(1).max(80),
      titleEn: z.string().trim().min(1).max(80),
      bodyKa: z.string().trim().min(1).max(300),
      bodyEn: z.string().trim().min(1).max(300),
    })
  )
  .length(3)
  .optional()
  .nullable();

// One extra downloadable file (DigitalProduct.additionalFiles) — same url
// conventions as fileUrl (cdcblob:// marker from /upload-file, or a plain
// external URL), plus the original filename for display.
const productFileSchema = z.object({
  url: z.string().url().max(2000),
  name: z.string().trim().min(1).max(255),
});
const MAX_ADDITIONAL_FILES = 20;

const router = Router();
router.use(authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), hideMoneyFromNonSuperAdmin);

router.post(
  '/upload-image',
  (req: Request, res: Response, next: NextFunction) => imageUpload.single('image')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      const protectedImage = await protectProductPreviewImage(req.file.buffer, req.file.mimetype);
      const extension = protectedImage.mimetype === 'image/jpeg' ? '.jpg' : path.extname(req.file.originalname);
      const filename = `product-${Date.now()}-${crypto.randomUUID()}${extension}`;
      const url = await uploadImage({ buffer: protectedImage.buffer, mimetype: protectedImage.mimetype, folderName: 'product-images', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post(
  '/upload-video',
  (req: Request, res: Response, next: NextFunction) => videoUpload.single('video')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      const filename = `product-video-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'product-videos', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Video upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post(
  '/upload-file',
  (req: Request, res: Response, next: NextFunction) => fileUpload.single('file')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      // Private Azure Blob storage — see productFileDelivery.ts. Returned
      // `url` is a cdcblob:// marker, resolved to a real short-lived link
      // only by products.ts's purchase-gated GET /:id/download.
      const url = await uploadProductFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.status(201).json({ data: { url, name: req.file.originalname } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'File upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  // Left blank, both are auto-translated by Gemini before the product is
  // created — see aiTranslateService.ts's autoTranslateIfBlank.
  titleEn: z.string().min(1).max(200).optional().nullable(),
  descriptionEn: z.string().min(1).max(5000).optional().nullable(),
  // Major-unit GEL from the admin form — converted to minor units (tetri)
  // here so every other money field in the DB (Course.originalPrice,
  // BogPayment.amount) stays in the same unit.
  price: z.number().min(0),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  // Up to 15 additional showcase screenshots alongside imageUrl (the main
  // cover) — empty is fine, a submission isn't required to have a gallery.
  previewImages: z.array(z.string().url()).max(15).optional().default([]),
  previewVideoUrl: z.string().url().optional().nullable(),
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(255).optional().nullable(),
  additionalFiles: z.array(productFileSchema).max(MAX_ADDITIONAL_FILES).optional().default([]),
  licenseType: z.nativeEnum(ProductLicenseType).optional(),
  discountedPrice: z.number().min(0).optional().nullable(),
  saleEndsAt: z.string().datetime().optional().nullable().or(z.literal('')),
  // Optional scheduled start of the sale — same ISO/empty conventions as saleEndsAt.
  saleStartsAt: z.string().datetime().optional().nullable().or(z.literal('')),
  howItWorksSteps: howItWorksStepsSchema,
  // Marks this as a web tool/SaaS product — /store/[id] shows "Launch Tool"
  // linking here instead of the normal download flow. A plain in-app path
  // (e.g. "/dashboard/tools/chatbot-builder"), not a full URL.
  toolRoute: z.string().max(500).optional().nullable(),
});

// Admin-authored products skip moderation — there's no point an admin
// approving their own submission — unlike products.ts's graduate-facing
// POST /, which always lands PENDING.
router.post('/', async (req: Request, res: Response) => {
  // Prices are SUPER_ADMIN-only (moneyVisibility.ts already dropped any
  // price fields). A MANAGER's product is created unpriced and PENDING, so a
  // Super Admin sets the price before it reaches the store.
  const canPrice = req.adminRole === 'SUPER_ADMIN';
  if (!canPrice && req.body && typeof req.body === 'object') req.body.price = 0;
  const result = createSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const priceMinor = Math.round(result.data.price * 100);
  const discountedPriceMinor = result.data.discountedPrice != null ? Math.round(result.data.discountedPrice * 100) : null;
  if (discountedPriceMinor !== null) {
    const discountError = validateProductDiscount(priceMinor, discountedPriceMinor);
    if (discountError) return res.status(400).json({ message: discountError });
  }

  const { titleEn, descriptionEn } = await autoTranslateIfBlank(
    result.data.title,
    result.data.description,
    result.data.titleEn,
    result.data.descriptionEn,
    'adminProducts'
  );

  const saleWindowError = validateSaleWindow(result.data.saleStartsAt, result.data.saleEndsAt);
  if (saleWindowError) return res.status(400).json({ message: saleWindowError });

  const { discountedPrice, saleEndsAt, saleStartsAt, howItWorksSteps, ...rest } = result.data;
  const product = await prisma.digitalProduct.create({
    data: {
      ...rest,
      titleEn,
      descriptionEn,
      price: priceMinor,
      discountedPrice: discountedPriceMinor,
      saleEndsAt: toPrismaSaleEndsAt(saleEndsAt) ?? null,
      saleStartsAt: toPrismaSaleEndsAt(saleStartsAt) ?? null,
      howItWorksSteps: toPrismaJson(howItWorksSteps),
      status: canPrice ? 'APPROVED' : 'PENDING',
    },
  });
  res.status(201).json({ data: withCurrentProductPrice(product) });
});

// Lets an admin open/check an attached product file from the edit form —
// including one just uploaded and not saved yet — without having to buy the
// product. Same resolution as the buyer's GET /products/:id/download (a
// short-lived signed link for cdcblob:// markers, external URLs as-is), so
// never cache the result.
router.post('/file-link', async (req: Request, res: Response) => {
  const result = z.object({ url: z.string().url().max(2000) }).safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const url = await resolveProductFileDeliveryUrl(result.data.url);
  res.json({ data: { url } });
});

// Full list across every status — the public GET /api/products only ever
// shows APPROVED, so the moderation queue needs its own view. No locale or
// submitter filter: every SUPER_ADMIN/MANAGER (see router.use above) sees
// every product regardless of who submitted it or the site's active
// language — status filtering (PENDING/APPROVED/etc.) is handled entirely
// client-side by the admin panel from this same full list.
router.get('/', async (_req: Request, res: Response) => {
  const products = await prisma.digitalProduct.findMany({
    orderBy: { createdAt: 'desc' },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });
  res.json({ data: products.map(withCurrentProductPrice) });
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
  titleEn: z.string().min(1).max(200).optional().nullable(),
  descriptionEn: z.string().min(1).max(5000).optional().nullable(),
  category: z.string().min(1).max(100).optional(),
  // Major-unit GEL, same conversion as createSchema — omit to leave price unchanged.
  price: z.number().finite().min(0).max(21474836.47).optional(),
  // Integer tetri for inline edits; preserve the existing GEL price contract.
  priceMinor: z.number().finite().int().min(0).max(2147483647).optional(),
  imageUrl: z.string().url().optional(),
  previewImages: z.array(z.string().url()).max(15).optional(),
  previewVideoUrl: z.string().url().optional().nullable(),
  // Replacing the main downloadable file / managing extra ones from the
  // edit form. fileUrl can be swapped but never cleared — the column is
  // required and every purchase flow assumes a main file exists.
  fileUrl: z.string().url().optional(),
  fileName: z.string().trim().min(1).max(255).optional().nullable(),
  additionalFiles: z.array(productFileSchema).max(MAX_ADDITIONAL_FILES).optional(),
  licenseType: z.nativeEnum(ProductLicenseType).optional(),
  discountedPrice: z.number().min(0).optional().nullable(),
  saleEndsAt: z.string().datetime().optional().nullable().or(z.literal('')),
  // Optional scheduled start of the sale — same ISO/empty conventions as saleEndsAt.
  saleStartsAt: z.string().datetime().optional().nullable().or(z.literal('')),
  howItWorksSteps: howItWorksStepsSchema,
  toolRoute: z.string().max(500).optional().nullable(),
}).refine((data) => data.price === undefined || data.priceMinor === undefined, {
  message: 'Send either price (GEL) or priceMinor (tetri), not both.', path: ['priceMinor'],
});

// Lets an admin fix typos/formatting on a graduate/freelancer submission
// (or an admin-authored product) before approving it — separate from
// approve/reject so an admin can save edits without also deciding the
// status in the same request.
router.put('/:id', async (req: Request, res: Response) => {
  const result = updateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const existing = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Product not found.' });

  // Auto-translate against whatever the title/description will actually be
  // post-update (the new value if provided, else the existing one) — a
  // title-only edit still gets a fresh titleEn/descriptionEn if both are
  // still blank, not just a brand-new product.
  const { titleEn, descriptionEn } = await autoTranslateIfBlank(
    result.data.title ?? existing.title,
    result.data.description ?? existing.description,
    result.data.titleEn !== undefined ? result.data.titleEn : existing.titleEn,
    result.data.descriptionEn !== undefined ? result.data.descriptionEn : existing.descriptionEn,
    'adminProducts'
  );

  const { price, priceMinor: requestedPriceMinor, discountedPrice, saleEndsAt, saleStartsAt, howItWorksSteps, ...rest } = result.data;
  const effectiveStart = saleStartsAt !== undefined ? saleStartsAt : existing.saleStartsAt?.toISOString() ?? null;
  const effectiveEnd = saleEndsAt !== undefined ? saleEndsAt : existing.saleEndsAt?.toISOString() ?? null;
  const saleWindowError = validateSaleWindow(effectiveStart, effectiveEnd);
  if (saleWindowError) return res.status(400).json({ message: saleWindowError });
  const priceMinor = requestedPriceMinor ?? (price !== undefined ? Math.round(price * 100) : existing.price);
  const discountedPriceMinor =
    discountedPrice !== undefined ? (discountedPrice != null ? Math.round(discountedPrice * 100) : null) : existing.discountedPrice;
  if (discountedPriceMinor !== null) {
    const discountError = validateProductDiscount(priceMinor, discountedPriceMinor);
    if (discountError) return res.status(400).json({ message: discountError });
  }

  try {
    const updated = await prisma.digitalProduct.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        titleEn,
        descriptionEn,
        ...(price !== undefined || requestedPriceMinor !== undefined ? { price: priceMinor } : {}),
        discountedPrice: discountedPriceMinor,
        ...(saleEndsAt !== undefined ? { saleEndsAt: toPrismaSaleEndsAt(saleEndsAt) } : {}),
        ...(saleStartsAt !== undefined ? { saleStartsAt: toPrismaSaleEndsAt(saleStartsAt) } : {}),
        ...(howItWorksSteps !== undefined ? { howItWorksSteps: toPrismaJson(howItWorksSteps) } : {}),
      },
    });
    if (priceMinor !== existing.price || discountedPriceMinor !== existing.discountedPrice || saleEndsAt !== undefined || saleStartsAt !== undefined) {
      await logAdminAction({
        action: 'products.updatePricing',
        targetType: 'DigitalProduct',
        targetId: existing.id,
        performedById: req.user!.id,
        metadata: {
          price: { from: existing.price, to: updated.price },
          discountedPrice: { from: existing.discountedPrice, to: updated.discountedPrice },
          saleStartsAt: updated.saleStartsAt,
          saleEndsAt: updated.saleEndsAt,
        },
      });
    }
    res.json({ data: withCurrentProductPrice(updated) });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Product not found.' });
    throw err;
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  // An unpriced product going live is a pricing decision — SUPER_ADMIN only.
  if (req.adminRole !== 'SUPER_ADMIN' && product.price === 0) {
    return res.status(403).json({ message: 'Only a Super Admin can approve a product that has no price yet.' });
  }

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

// ============================================================
// Soft delete. A product is never hard-deleted from the admin panel:
// ProductPurchase/reviews/user designs reference it, and buyers keep
// lifetime download rights (products.ts's /:id/download ignores status).
// ARCHIVED hides it from the public catalog and blocks new checkouts
// (marketplaceCheckout.ts, stripePayments.ts, products.ts /:id/claim all
// require APPROVED); restore puts it straight back on sale.
// ============================================================
router.post('/:id/archive', async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, title: true } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (product.status === 'ARCHIVED') return res.status(400).json({ message: 'Product is already archived.' });

  const updated = await prisma.digitalProduct.update({ where: { id: product.id }, data: { status: 'ARCHIVED' } });
  await logAdminAction({
    action: 'products.archive',
    targetType: 'DigitalProduct',
    targetId: product.id,
    performedById: req.user!.id,
    metadata: { previousStatus: product.status, title: product.title },
  });
  res.json({ data: withCurrentProductPrice(updated) });
});

router.post('/:id/restore', async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id }, select: { id: true, status: true, title: true } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (product.status !== 'ARCHIVED') return res.status(400).json({ message: 'Only archived products can be restored.' });

  const updated = await prisma.digitalProduct.update({ where: { id: product.id }, data: { status: 'APPROVED' } });
  await logAdminAction({
    action: 'products.restore',
    targetType: 'DigitalProduct',
    targetId: product.id,
    performedById: req.user!.id,
    metadata: { title: product.title },
  });
  res.json({ data: withCurrentProductPrice(updated) });
});

export default router;
