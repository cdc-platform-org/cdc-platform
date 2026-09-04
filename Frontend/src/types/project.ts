export type ProjectStatus = 'DRAFT' | 'PUBLISHED';

export interface Project {
  id: string;
  title: string;
  date: string;
  location: string | null;
  shortDescription: string;
  fullContent: string;
  coverImage: string;
  galleryImages: string[];
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
