interface ProductReviewer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  user: ProductReviewer;
  rating: number;
  comment: string;
  images: string[];
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  // Every ProductReview is backed by a server-verified COMPLETED purchase
  // (see Backend's routes/productReviews.ts) — always true, included for
  // display convenience rather than as something the client could fake.
  verifiedBuyer: true;
  helpfulVoted: boolean;
}

export type StarBreakdown = Record<'1' | '2' | '3' | '4' | '5', number> | Record<number, number>;

export interface ProductReviewsSummary {
  averageRating: number | null;
  reviewCount: number;
  starBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
  reviews: ProductReview[];
  myReview: ProductReview | null;
  canReview: boolean;
}

export interface SellerReviewsSummary {
  seller: {
    id: string;
    name: string;
    avatarUrl: string | null;
    sellerRating: number | null;
    sellerReviewCount: number;
  };
  reviews: (ProductReview & { product: { id: string; title: string; titleEn: string | null } })[];
}

export interface AdminProductReview {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  helpfulCount: number;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; title: string; submittedById: string | null };
}
