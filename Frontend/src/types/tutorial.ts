export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  titleEn: string | null;
  descriptionEn: string | null;
  order: number;
  // Null = draft. Non-null = published, ISO timestamp.
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // At most one tutorial is ever featured at a time — the homepage's promo
  // video button opens whichever one has this set.
  isFeatured: boolean;
}
