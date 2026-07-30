import apiClient from './apiClient';
import { StudioCaseStudy } from '../types/studioCaseStudy';

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
  coverImageUrl?: string | null;
  galleryImages?: string[];
  projectUrl?: string | null;
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

export async function uploadStudioCaseImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ url: string }>('/admin/studio/cases/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}
