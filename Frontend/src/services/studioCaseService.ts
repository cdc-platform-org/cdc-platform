import apiClient from './apiClient';
import { StudioCaseStudy } from '../types/studioCaseStudy';

// English falls back to the Georgian (primary) field whenever a case has no
// translation set yet — same pattern as blogService.ts's blogTitle/
// blogDescription/blogContent, used by the public /cases pages.
export function studioCaseTitle(item: StudioCaseStudy, lang: 'ka' | 'en'): string {
  return (lang === 'en' && item.titleEn) || item.title;
}
export function studioCaseDescription(item: StudioCaseStudy, lang: 'ka' | 'en'): string {
  return (lang === 'en' && item.descriptionEn) || item.description;
}
export function studioCaseFullStory(item: StudioCaseStudy, lang: 'ka' | 'en'): string | null {
  return (lang === 'en' && item.fullStoryEn) || item.fullStory;
}

// Public — GET /api/studio/cases (list) / GET /api/studio/cases/:slug
// (detail), for the /cases showcase, the case detail page, and the
// homepage's "Featured Case Studies" block.
export async function getStudioCases(featured?: boolean): Promise<StudioCaseStudy[]> {
  const response = await apiClient.get<{ data: StudioCaseStudy[] }>('/studio/cases', {
    params: featured ? { featured: 'true' } : undefined,
  });
  return response.data.data;
}

export async function getStudioCaseBySlug(slug: string): Promise<StudioCaseStudy> {
  const response = await apiClient.get<{ data: StudioCaseStudy }>(`/studio/cases/${slug}`);
  return response.data.data;
}

export interface StudioCasePayload {
  title: string;
  clientName: string;
  category: string;
  description: string;
  fullStory?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  fullStoryEn?: string | null;
  coverImageUrl?: string | null;
  galleryImages?: string[];
  projectUrl?: string | null;
  videoUrl?: string | null;
  isFeatured?: boolean;
  order?: number;
}

export async function adminGetStudioCases(): Promise<StudioCaseStudy[]> {
  const response = await apiClient.get<{ data: StudioCaseStudy[] }>('/admin/studio/cases');
  return response.data.data;
}

export async function createStudioCase(payload: StudioCasePayload): Promise<StudioCaseStudy> {
  const response = await apiClient.post<{ data: StudioCaseStudy }>('/admin/studio/cases', payload);
  return response.data.data;
}

export async function updateStudioCase(id: string, payload: Partial<StudioCasePayload>): Promise<StudioCaseStudy> {
  const response = await apiClient.put<{ data: StudioCaseStudy }>(`/admin/studio/cases/${id}`, payload);
  return response.data.data;
}

export async function deleteStudioCase(id: string): Promise<void> {
  await apiClient.delete(`/admin/studio/cases/${id}`);
}

export interface TranslateStudioCaseResult {
  titleEn: string;
  descriptionEn: string;
  fullStoryEn: string;
}

// Gemini-backed — see Backend's POST /api/ai/translate-studio-case. Admin-only.
export async function translateStudioCase(payload: {
  title: string;
  description: string;
  fullStory: string;
}): Promise<TranslateStudioCaseResult> {
  const response = await apiClient.post<{ data: TranslateStudioCaseResult }>('/ai/translate-studio-case', payload);
  return response.data.data;
}

export async function uploadStudioCaseImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ url: string }>('/admin/studio/cases/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}
