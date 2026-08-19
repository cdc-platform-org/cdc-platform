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
}
