export interface SuccessStory {
  id: string;
  studentName: string;
  slug: string;
  avatarUrl: string | null;
  roleTitle: string;
  roleTitleEn: string | null;
  courseName: string;
  testimonial: string;
  testimonialEn: string | null;
  storyContent: string | null;
  storyContentEn: string | null;
  galleryImages: string[];
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  hiredBy: string | null;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}
