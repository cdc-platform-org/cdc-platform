import { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

// Recomputes the denormalized rating rollups touched by a product-review
// create/delete: the reviewed DigitalProduct's own averageRating/reviewCount,
// and — if it has a real external creator — that creator's seller-wide
// sellerRating/sellerReviewCount across every product they've submitted.
// Called after every write in routes/productReviews.ts and
// routes/adminProductReviews.ts so the two rollups never drift from the
// underlying ProductReview rows.
export async function recomputeProductReviewAggregates(db: Db, productId: string): Promise<void> {
  const [productAgg, product] = await Promise.all([
    db.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    db.digitalProduct.findUnique({ where: { id: productId }, select: { submittedById: true } }),
  ]);

  await db.digitalProduct.update({
    where: { id: productId },
    data: {
      averageRating: productAgg._avg.rating ?? null,
      reviewCount: productAgg._count.rating,
    },
  });

  if (!product?.submittedById) return;

  const sellerAgg = await db.productReview.aggregate({
    where: { product: { submittedById: product.submittedById } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await db.user.update({
    where: { id: product.submittedById },
    data: {
      sellerRating: sellerAgg._avg.rating ?? null,
      sellerReviewCount: sellerAgg._count.rating,
    },
  });
}
