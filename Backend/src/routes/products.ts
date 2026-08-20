import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { z } from 'zod';
import { ProductLicenseType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate, requireApproved } from '../middleware/auth';
import { isBusinessToolsCategory, canPurchaseBusinessTools } from '../utils/marketplaceCategories';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { imageUpload, fileUpload, multerErrorHandler } from '../middleware/productUploads';
import { fileFormatFromUrl } from '../utils/fileFormat';
import { moderateProduct, ModerationInput } from '../services/productModerationService';
import { getAiAutomationSettings } from '../services/aiAutomationSettingsService';
import { autoTranslateIfBlank } from '../services/aiTranslateService';
import { protectProductPreviewImage } from '../services/productImageProtection';
import { uploadProductFile, resolveProductFileDeliveryUrl } from '../services/productFileDelivery';
import { withCurrentProductPrice, validateProductDiscount } from '../services/productPricing';

// ISO string (or '' / null / undefined for "no sale end date") from the
// form's <input type="datetime-local"> — mirrors courses.ts's identical
// toPrismaDiscountEndDate helper. Prisma's DateTime field needs an actual
// Date or null, never an empty string.
function toPrismaSaleEndsAt(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return new Date(value);
}

const router = Router();

// ============================================================
// CATALOG — public, but attaches `purchased` per item when a valid token
// is present (optionalAuthenticate) so the store can show "შენი ნაყიდი".
// Only ever shows APPROVED products — PENDING/REJECTED submissions are
// only visible to their submitter (GET /:id below) or admins (adminProducts.ts).
// ============================================================
router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const products = await prisma.digitalProduct.findMany({
    where: { status: 'APPROVED', ...(category ? { category } : {}) },
    orderBy: { createdAt: 'desc' },
  });

  const purchasedIds = req.user
    ? new Set(
        (
          await prisma.productPurchase.findMany({
            where: { userId: req.user.id, paymentStatus: 'COMPLETED', productId: { in: products.map((p) => p.id) } },
            select: { productId: true },
          })
        ).map((p) => p.productId)
      )
    : new Set<string>();

  res.json({
    data: products.map((p) => {
      // Deliberately pulling only currentPrice/saleActive out of
      // withCurrentProductPrice(p), not spreading its whole return value —
      // that includes every raw column (fileUrl, submittedById, etc.) this
      // hand-picked public shape exists specifically to keep off the
      // catalog response.
      const { currentPrice, saleActive } = withCurrentProductPrice(p);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        discountedPrice: saleActive ? p.discountedPrice : null,
        saleEndsAt: saleActive ? p.saleEndsAt : null,
        currentPrice,
        saleActive,
        category: p.category,
        imageUrl: p.imageUrl,
        previewImages: p.previewImages,
        fileFormat: fileFormatFromUrl(p.fileUrl),
        licenseType: p.licenseType,
        downloadsCount: p.downloadsCount,
        salesCount: p.salesCount,
        createdAt: p.createdAt,
        purchased: purchasedIds.has(p.id),
      };
    }),
  });
});

router.get('/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  // Not-yet-approved products are only visible to whoever submitted them —
  // everyone else (including other logged-in users) gets a 404, same as if
  // it didn't exist. Admins review these via GET /admin/products instead.
  if (product.status !== 'APPROVED' && product.submittedById !== req.user?.id) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  let purchased = false;
  if (req.user) {
    const purchase = await prisma.productPurchase.findUnique({
      where: { userId_productId: { userId: req.user.id, productId: product.id } },
    });
    purchased = purchase?.paymentStatus === 'COMPLETED';
  }

  const { currentPrice, saleActive } = withCurrentProductPrice(product);
  res.json({
    data: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      discountedPrice: saleActive ? product.discountedPrice : null,
      saleEndsAt: saleActive ? product.saleEndsAt : null,
      currentPrice,
      saleActive,
      category: product.category,
      imageUrl: product.imageUrl,
      previewImages: product.previewImages,
      fileFormat: fileFormatFromUrl(product.fileUrl),
      licenseType: product.licenseType,
      downloadsCount: product.downloadsCount,
      salesCount: product.salesCount,
      createdAt: product.createdAt,
      purchased,
      status: product.status,
      rejectionReason: product.rejectionReason,
    },
  });
});

const submitSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  // Left blank, both are auto-translated by Gemini before the product is
  // created/resubmitted — see aiTranslateService.ts's autoTranslateIfBlank.
  titleEn: z.string().min(1).max(200).optional().nullable(),
  descriptionEn: z.string().min(1).max(5000).optional().nullable(),
  price: z.number().min(0),
  category: z.string().min(1).max(100),
  imageUrl: z.string().url(),
  // Up to 4 additional showcase screenshots alongside imageUrl (the main
  // cover) — empty is fine, a submission isn't required to have a gallery.
  previewImages: z.array(z.string().url()).max(4).optional().default([]),
  fileUrl: z.string().url(),
  // Omit to keep the schema-level default (PERSONAL_USE, the most
  // restrictive option) — a submitter has to deliberately pick a broader
  // license, not have one granted by omission.
  licenseType: z.nativeEnum(ProductLicenseType).optional(),
  // Major-unit GEL, same as price — converted + validated (productPricing.ts's
  // validateProductDiscount) in the route handler, not here, since that
  // needs the already-converted minor-unit price to compare against.
  discountedPrice: z.number().min(0).optional().nullable(),
  // ISO string from <input type="datetime-local">, or '' / null to clear.
  saleEndsAt: z.string().datetime().optional().nullable().or(z.literal('')),
});

// Shared by POST / below and the two upload-* routes further down — a
// submitter needs the exact same standing (verified graduate/freelancer, or
// any admin-team member) to upload assets as to submit the product itself.
// Centralized so the two checks can't silently drift apart.
async function canSubmitProducts(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isVerifiedGraduate: true, adminRole: true },
  });
  return !!(user?.isVerifiedGraduate || user?.adminRole);
}
const CANNOT_SUBMIT_MESSAGE = 'Only verified graduates/freelancers or admins can submit products for review.';

// Business rule: a regular seller (verified graduate/freelancer, no
// adminRole) may never publish a $0 product — only an admin-team member can,
// for deliberate free lead-magnet listings. A non-admin's price must clear
// the same >=2 GEL floor the payment gateway needs to cover its own
// per-transaction processing fee; anything between 0 and 2 GEL exclusive is
// just as disallowed as exactly 0.
const MIN_SUBMITTER_PRICE_GEL = 2;
function validateSubmitterPrice(priceGel: number, isAdminTeamMember: boolean): string | null {
  if (isAdminTeamMember) return null;
  if (priceGel === 0) {
    return 'Only CDC admins can publish a free (0 GEL) product. Set a price of at least 2 GEL, or ask an admin to publish it as a free lead-magnet listing.';
  }
  if (priceGel < MIN_SUBMITTER_PRICE_GEL) {
    return `Price must be at least ${MIN_SUBMITTER_PRICE_GEL} GEL to cover payment processing fees.`;
  }
  return null;
}

// Runs before multer so an unauthorized caller's upload is rejected without
// ever buffering the file into memory.
async function requireCanSubmitProducts(req: Request, res: Response, next: NextFunction) {
  if (!(await canSubmitProducts(req.user!.id))) {
    return res.status(403).json({ message: CANNOT_SUBMIT_MESSAGE });
  }
  next();
}

// ============================================================
// UPLOAD — verified graduates/freelancers and admin-team members only
// (canSubmitProducts, same gate as POST / below). Unlike adminProducts.ts's
// identically-shaped /upload-image and /upload-file (SUPER_ADMIN/MANAGER
// only, used for admin-authored catalog entries), these exist so a regular
// verified submitter can actually attach real files to their own
// submission instead of having to already have the asset hosted elsewhere
// and paste a URL.
// ============================================================
router.post(
  '/upload-image',
  authenticate,
  requireApproved,
  requireCanSubmitProducts,
  (req: Request, res: Response, next: NextFunction) => imageUpload.single('image')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      // Resized/watermarked before it ever reaches storage — see
      // productImageProtection.ts. Always re-encoded to JPEG, so the stored
      // filename's extension reflects that rather than the upload's original.
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
  '/upload-file',
  authenticate,
  requireApproved,
  requireCanSubmitProducts,
  (req: Request, res: Response, next: NextFunction) => fileUpload.single('file')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      // Private Azure Blob storage, not the public Bunny CDN used for
      // images above — the returned `url` is a cdcblob:// marker, not a
      // working link. See productFileDelivery.ts for why.
      const url = await uploadProductFile(req.file.buffer, req.file.mimetype, req.file.originalname);
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'File upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// ============================================================
// SUBMIT — verified freelancers/graduates (isVerifiedGraduate — the same
// flag set by either passing the freelancer skill exam or completing a
// CDC course, see freelancerExam.ts/courses.ts) and admin-team members can
// submit a product for review. Always lands as PENDING here regardless of
// who submits — only adminProducts.ts's admin-authored POST / inserts as
// APPROVED directly.
// ============================================================
// ============================================================
// AI MODERATION — runs once per submission/resubmission (products.ts's
// POST / and PUT /:id/mine), never on admin-authored products
// (adminProducts.ts's POST / inserts APPROVED directly, no review needed).
// Returns the status/AI-field patch to apply; a Gemini failure or a FLAGged
// verdict both resolve to plain PENDING — the same "a human looks at it"
// outcome as if this feature didn't exist, just with AI context attached
// when available. Auto-APPROVE only fires when the model's own verdict AND
// both admin-configured thresholds agree — either one alone falls back to
// PENDING, not straight to NEEDS_REVISION (an uncertain-but-not-bad listing
// deserves a human look, not automated rejection-shaped feedback).
// ============================================================
async function runAiModeration(
  input: ModerationInput
): Promise<{
  status: 'APPROVED' | 'NEEDS_REVISION' | 'PENDING';
  rejectionReason: string | null;
  aiReviewScore: number | null;
  aiReviewConfidence: number | null;
  aiReviewReasoning: string | null;
  aiReviewedAt: Date | null;
}> {
  const result = await moderateProduct(input);
  if (!result) {
    return { status: 'PENDING', rejectionReason: null, aiReviewScore: null, aiReviewConfidence: null, aiReviewReasoning: null, aiReviewedAt: null };
  }

  const { autoApproveScoreThreshold, autoApproveConfidenceThreshold } = await getAiAutomationSettings();
  const clearsThreshold = result.score >= autoApproveScoreThreshold && result.confidence >= autoApproveConfidenceThreshold;

  const status: 'APPROVED' | 'NEEDS_REVISION' | 'PENDING' =
    result.verdict === 'APPROVE' && clearsThreshold ? 'APPROVED' : result.verdict === 'NEEDS_REVISION' ? 'NEEDS_REVISION' : 'PENDING';

  return {
    status,
    rejectionReason: status === 'NEEDS_REVISION' ? result.reasoningKa : null,
    aiReviewScore: result.score,
    aiReviewConfidence: result.confidence,
    aiReviewReasoning: result.reasoningEn,
    aiReviewedAt: new Date(),
  };
}

router.post('/', authenticate, requireApproved, async (req: Request, res: Response) => {
  const submitter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isVerifiedGraduate: true, adminRole: true } });
  if (!(submitter?.isVerifiedGraduate || submitter?.adminRole)) {
    return res.status(403).json({ message: CANNOT_SUBMIT_MESSAGE });
  }

  const result = submitSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const priceMinor = Math.round(result.data.price * 100);

  const priceError = validateSubmitterPrice(result.data.price, !!submitter.adminRole);
  if (priceError) return res.status(400).json({ message: priceError });

  const discountedPriceMinor = result.data.discountedPrice != null ? Math.round(result.data.discountedPrice * 100) : null;
  if (discountedPriceMinor !== null) {
    const discountError = validateProductDiscount(priceMinor, discountedPriceMinor);
    if (discountError) return res.status(400).json({ message: discountError });
  }

  const moderation = await runAiModeration({
    title: result.data.title,
    description: result.data.description,
    category: result.data.category,
    price: priceMinor,
    imageUrl: result.data.imageUrl,
    previewImages: result.data.previewImages ?? [],
  });

  const { titleEn, descriptionEn } = await autoTranslateIfBlank(
    result.data.title,
    result.data.description,
    result.data.titleEn,
    result.data.descriptionEn,
    'products'
  );

  const { discountedPrice, saleEndsAt, ...rest } = result.data;
  const product = await prisma.digitalProduct.create({
    data: {
      ...rest,
      titleEn,
      descriptionEn,
      price: priceMinor,
      discountedPrice: discountedPriceMinor,
      saleEndsAt: toPrismaSaleEndsAt(saleEndsAt) ?? null,
      submittedById: req.user!.id,
      ...moderation,
    },
  });

  if (moderation.status === 'APPROVED') {
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        title: 'თქვენი პროდუქტი ავტომატურად დამტკიცდა! 🎉',
        message: `„${product.title}" AI მოდერაციამ დაამტკიცა და უკვე გამოქვეყნებულია ციფრულ მაღაზიაში.`,
        type: 'PRODUCT_MODERATION',
      },
    });
  } else if (moderation.status === 'NEEDS_REVISION') {
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        title: 'თქვენი პროდუქტი საჭიროებს ცვლილებებს',
        message: `„${product.title}": ${moderation.rejectionReason}`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.status(201).json({ data: product });
});

router.get('/mine/submissions', authenticate, requireApproved, async (req: Request, res: Response) => {
  const products = await prisma.digitalProduct.findMany({
    where: { submittedById: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  // Full raw rows (including discountedPrice/saleEndsAt even when expired)
  // are fine here — this is the submitter's own dashboard/edit form, not a
  // public-facing price display, so it needs the actual stored values to
  // pre-fill editing, not the "only while active" gate GET /'s catalog uses.
  res.json({ data: products.map(withCurrentProductPrice) });
});

const updateMySubmissionSchema = submitSchema.partial();

// ============================================================
// EDIT & RESUBMIT — the submitter's own PENDING/NEEDS_REVISION
// submission only (never APPROVED — a live catalog listing goes through
// adminProducts.ts's PUT /:id instead, an admin-only action). Always
// resets status back to PENDING and clears any prior rejectionReason/
// feedback, since editing content is exactly what "resubmit after
// requested changes" means — the admin needs to look at it again either way.
// ============================================================
router.put('/:id/mine', authenticate, requireApproved, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (product.submittedById !== req.user!.id) {
    return res.status(403).json({ message: 'You can only edit your own submissions.' });
  }
  if (product.status === 'APPROVED') {
    return res.status(400).json({ message: 'This product is already published and can no longer be edited here.' });
  }

  const result = updateMySubmissionSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const { price, discountedPrice, saleEndsAt, ...rest } = result.data;

  if (price !== undefined) {
    const submitter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
    const priceError = validateSubmitterPrice(price, !!submitter?.adminRole);
    if (priceError) return res.status(400).json({ message: priceError });
  }

  const priceMinor = price !== undefined ? Math.round(price * 100) : product.price;
  // Explicit null clears a discount; undefined (field omitted) leaves the
  // existing one untouched — same three-way distinction the rest of this
  // codebase's optional-nullable Zod fields use (see titleEn/descriptionEn
  // just below).
  const discountedPriceMinor = discountedPrice !== undefined ? (discountedPrice != null ? Math.round(discountedPrice * 100) : null) : product.discountedPrice;
  if (discountedPriceMinor !== null) {
    const discountError = validateProductDiscount(priceMinor, discountedPriceMinor);
    if (discountError) return res.status(400).json({ message: discountError });
  }

  const moderation = await runAiModeration({
    title: result.data.title ?? product.title,
    description: result.data.description ?? product.description,
    category: result.data.category ?? product.category,
    price: priceMinor,
    imageUrl: result.data.imageUrl ?? product.imageUrl,
    previewImages: result.data.previewImages ?? product.previewImages,
  });

  const { titleEn, descriptionEn } = await autoTranslateIfBlank(
    result.data.title ?? product.title,
    result.data.description ?? product.description,
    result.data.titleEn !== undefined ? result.data.titleEn : product.titleEn,
    result.data.descriptionEn !== undefined ? result.data.descriptionEn : product.descriptionEn,
    'products'
  );

  const updated = await prisma.digitalProduct.update({
    where: { id: product.id },
    data: {
      ...rest,
      titleEn,
      descriptionEn,
      ...(price !== undefined ? { price: priceMinor } : {}),
      discountedPrice: discountedPriceMinor,
      ...(saleEndsAt !== undefined ? { saleEndsAt: toPrismaSaleEndsAt(saleEndsAt) } : {}),
      ...moderation,
    },
  });

  if (moderation.status === 'APPROVED') {
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        title: 'თქვენი პროდუქტი ავტომატურად დამტკიცდა! 🎉',
        message: `„${updated.title}" AI მოდერაციამ დაამტკიცა და უკვე გამოქვეყნებულია ციფრულ მაღაზიაში.`,
        type: 'PRODUCT_MODERATION',
      },
    });
  } else if (moderation.status === 'NEEDS_REVISION') {
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        title: 'თქვენი პროდუქტი კვლავ საჭიროებს ცვლილებებს',
        message: `„${updated.title}": ${moderation.rejectionReason}`,
        type: 'PRODUCT_MODERATION',
      },
    });
  }

  res.json({ data: updated });
});

// ============================================================
// CLAIM — free (price = 0) products only. Paid products go through
// POST /api/payments/checkout/product/:productId (BOG) instead.
// ============================================================
router.post('/:id/claim', authenticate, requireApproved, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  if (product.price > 0) {
    return res.status(400).json({ message: 'This product is not free — use the checkout flow instead.' });
  }

  // The real enforcement boundary for the Business Tools purchase
  // restriction — the frontend's identical check (pages/store/[id].tsx) is
  // UX only and does not stop a direct API call.
  if (isBusinessToolsCategory(product.category)) {
    const requester = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { role: true, isVerified: true } });
    if (!canPurchaseBusinessTools(requester)) {
      return res.status(403).json({ message: 'This tool is available exclusively to verified Business accounts.' });
    }
  }

  const existing = await prisma.productPurchase.findUnique({
    where: { userId_productId: { userId: req.user!.id, productId: product.id } },
  });

  await prisma.$transaction([
    prisma.productPurchase.upsert({
      where: { userId_productId: { userId: req.user!.id, productId: product.id } },
      // A free product's licenseType can't have changed between an earlier
      // claim and a repeat call here (upsert is idempotent for this route
      // already), but re-stamping it on every call costs nothing and means a
      // pre-this-feature claim (licenseType null) self-heals the next time
      // the same user hits claim again.
      update: { licenseType: product.licenseType },
      create: { userId: req.user!.id, productId: product.id, amount: 0, paymentStatus: 'COMPLETED', licenseType: product.licenseType },
    }),
    // Only on a genuine first claim — existing already being COMPLETED means
    // this is just a repeat call (e.g. re-opening the product page), not a
    // new sale, so salesCount must not move.
    ...(existing?.paymentStatus === 'COMPLETED'
      ? []
      : [prisma.digitalProduct.update({ where: { id: product.id }, data: { salesCount: { increment: 1 } } })]),
  ]);

  res.status(200).json({ data: { claimed: true } });
});

// ============================================================
// DOWNLOAD — never returns fileUrl to anyone without a verified COMPLETED
// purchase; also fine for lifetime re-downloads (no expiry check). The
// resolved URL itself (for private-storage products) is short-lived — see
// productFileDelivery.ts — so re-hitting this endpoint is how a buyer gets
// a fresh working link, not a cached one going stale.
// ============================================================
router.get('/:id/download', authenticate, requireApproved, async (req: Request, res: Response) => {
  const purchase = await prisma.productPurchase.findUnique({
    where: { userId_productId: { userId: req.user!.id, productId: req.params.id } },
  });
  if (!purchase || purchase.paymentStatus !== 'COMPLETED') {
    return res.status(403).json({ message: 'You have not purchased this product.' });
  }

  const [product] = await Promise.all([
    prisma.digitalProduct.update({
      where: { id: req.params.id },
      data: { downloadsCount: { increment: 1 } },
    }),
    // Only set on the first download — re-downloads don't move the
    // timestamp, so it stays a reliable "was this ever opened" marker for
    // an admin weighing a refund request.
    purchase.downloadedAt
      ? Promise.resolve()
      : prisma.productPurchase.update({
          where: { userId_productId: { userId: req.user!.id, productId: req.params.id } },
          data: { downloadedAt: new Date() },
        }),
  ]);

  const fileUrl = await resolveProductFileDeliveryUrl(product.fileUrl);
  res.json({ data: { fileUrl, licenseType: purchase.licenseType ?? product.licenseType } });
});

export default router;
