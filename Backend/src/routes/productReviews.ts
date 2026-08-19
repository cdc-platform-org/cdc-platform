import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate, requireApproved } from '../middleware/auth';
import { createProductReviewSchema } from '../schemas/productReviewSchemas';
import { recomputeProductReviewAggregates } from '../services/productReviewAggregateService';
import { uploadImage } from '../services/imageStorage';
import { BunnyStorageUploadError } from '../services/bunnyStorage';
import { imageUpload, multerErrorHandler } from '../middleware/productUploads';

const router = Router();
const reviewerSelect = { select: { id: true, name: true, avatarUrl: true } };

// Optional proof/showcase photo attached to a review — any approved
// (not just verified-graduate/submitter) authenticated user can use this,
// unlike products.ts's /upload-image which is gated by canSubmitProducts.
router.post(
  '/upload-image',
  authenticate,
  requireApproved,
  (req: Request, res: Response, next: NextFunction) => imageUpload.single('image')(req, res, (err: any) => multerErrorHandler(req, res, err, next)),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    const filename = `product-review-${Date.now()}-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;
    try {
      const url = await uploadImage({ buffer: req.file.buffer, mimetype: req.file.mimetype, folderName: 'product-review-images', filename });
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'Image upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

// ============================================================
// CREATE — the verified-purchase gate lives entirely here, not in the
// frontend: a review can only be created against a ProductPurchase row that
// belongs to the caller (from the auth token, never the request body) and
// has paymentStatus COMPLETED. purchaseId is @unique on ProductReview, so a
// given purchase can never back more than one review.
// ============================================================
router.post('/', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = createProductReviewSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { productId, rating, comment, imageUrl } = result.data;

  const purchase = await prisma.productPurchase.findUnique({
    where: { userId_productId: { userId: req.user!.id, productId } },
  });
  if (!purchase || purchase.paymentStatus !== 'COMPLETED') {
    return res.status(403).json({ message: 'You can only review products you have purchased.' });
  }

  try {
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.productReview.create({
        data: {
          productId,
          userId: req.user!.id,
          purchaseId: purchase.id,
          rating,
          comment,
          imageUrl: imageUrl ?? null,
        },
        include: { user: reviewerSelect },
      });
      await recomputeProductReviewAggregates(tx, productId);
      return created;
    });

    res.status(201).json({ data: { ...review, verifiedBuyer: true, helpfulVoted: false } });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'You have already reviewed this product.' });
    }
    throw err;
  }
});

// ============================================================
// PRODUCT REVIEWS — public list + star breakdown, with per-viewer
// `canReview`/`myReview`/`helpfulVoted` context attached when authenticated
// (optionalAuthenticate). Every review here is by definition a verified
// buyer (enforced at create time above), so the badge is unconditional.
// ============================================================
router.get('/product/:productId', optionalAuthenticate, async (req: Request, res: Response) => {
  const product = await prisma.digitalProduct.findUnique({
    where: { id: req.params.productId },
    select: { id: true, averageRating: true, reviewCount: true },
  });
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  const [reviews, breakdown, myVotes] = await Promise.all([
    prisma.productReview.findMany({
      where: { productId: product.id },
      include: { user: reviewerSelect },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.productReview.groupBy({
      by: ['rating'],
      where: { productId: product.id },
      _count: { rating: true },
    }),
    req.user
      ? prisma.productReviewHelpfulVote.findMany({
          where: { userId: req.user.id, review: { productId: product.id } },
          select: { reviewId: true },
        })
      : Promise.resolve([]),
  ]);

  const votedReviewIds = new Set(myVotes.map((v) => v.reviewId));
  const starBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const row of breakdown) {
    starBreakdown[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
  }

  let myReview = null;
  let canReview = false;
  if (req.user) {
    myReview = reviews.find((r) => r.userId === req.user!.id) ?? null;
    if (!myReview) {
      const purchase = await prisma.productPurchase.findUnique({
        where: { userId_productId: { userId: req.user.id, productId: product.id } },
      });
      canReview = !!purchase && purchase.paymentStatus === 'COMPLETED';
    }
  }

  res.json({
    data: {
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
      starBreakdown,
      reviews: reviews.map((r) => ({ ...r, verifiedBuyer: true, helpfulVoted: votedReviewIds.has(r.id) })),
      myReview,
      canReview,
    },
  });
});

// ============================================================
// SELLER REVIEWS — public aggregate + review list across every product a
// given seller/creator has submitted, for the seller's public profile page.
// ============================================================
router.get('/seller/:sellerId', async (req: Request, res: Response) => {
  const seller = await prisma.user.findUnique({
    where: { id: req.params.sellerId },
    select: { id: true, name: true, avatarUrl: true, sellerRating: true, sellerReviewCount: true },
  });
  if (!seller) return res.status(404).json({ message: 'Seller not found.' });

  const reviews = await prisma.productReview.findMany({
    where: { product: { submittedById: seller.id } },
    include: { user: reviewerSelect, product: { select: { id: true, title: true, titleEn: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: { seller, reviews: reviews.map((r) => ({ ...r, verifiedBuyer: true })) } });
});

// ============================================================
// HELPFUL — toggle a "helpful" vote (authenticated, one per user per
// review — ProductReviewHelpfulVote's unique constraint is the real guard).
// ============================================================
router.post('/:id/helpful', authenticate, async (req: Request, res: Response) => {
  const review = await prisma.productReview.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!review) return res.status(404).json({ message: 'Review not found.' });

  const existingVote = await prisma.productReviewHelpfulVote.findUnique({
    where: { reviewId_userId: { reviewId: review.id, userId: req.user!.id } },
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (existingVote) {
      await tx.productReviewHelpfulVote.delete({ where: { id: existingVote.id } });
      return tx.productReview.update({ where: { id: review.id }, data: { helpfulCount: { decrement: 1 } } });
    }
    await tx.productReviewHelpfulVote.create({ data: { reviewId: review.id, userId: req.user!.id } });
    return tx.productReview.update({ where: { id: review.id }, data: { helpfulCount: { increment: 1 } } });
  });

  res.json({ data: { helpfulCount: updated.helpfulCount, helpfulVoted: !existingVote } });
});

export default router;
