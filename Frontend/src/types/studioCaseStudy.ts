export interface StudioCaseStudy {
  id: string;
  title: string;
  slug: string;
  clientName: string;
  category: string;
  description: string;
  fullStory: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  projectUrl: string | null;
  isFeatured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
