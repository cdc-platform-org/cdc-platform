export interface StudioCaseStudy {
  id: string;
  title: string;
  slug: string;
  clientName: string;
  category: string;
  description: string;
  fullStory: string | null;
  // English twins — null until auto-translated or manually filled in
  // /admin/studio-cases. Public pages fall back to the Georgian fields
  // when these are unset (see src/services/studioCaseService.ts's helpers).
  titleEn: string | null;
  descriptionEn: string | null;
  fullStoryEn: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  projectUrl: string | null;
  isFeatured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
