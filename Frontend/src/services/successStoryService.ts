import apiClient from './apiClient';
import { SuccessStory } from '../types/successStory';

// Public — GET /api/v1/success-stories. Pass featured=true for the
// homepage/course-page carousel (only isFeatured stories); omit for the
// admin list, which needs every story regardless of visibility.
export async function getSuccessStories(featured?: boolean): Promise<SuccessStory[]> {
  const response = await apiClient.get<{ data: SuccessStory[] }>('/v1/success-stories', {
    params: featured ? { featured: 'true' } : undefined,
  });
  return response.data.data;
}

export interface SuccessStoryPayload {
  studentName: string;
  roleTitle: string;
  courseName: string;
  testimonial: string;
  avatarUrl?: string | null;
  linkedinUrl?: string | null;
  isFeatured?: boolean;
}

export async function adminGetSuccessStories(): Promise<SuccessStory[]> {
  const response = await apiClient.get<{ data: SuccessStory[] }>('/admin/success-stories');
  return response.data.data;
}

export async function createSuccessStory(payload: SuccessStoryPayload): Promise<SuccessStory> {
  const response = await apiClient.post<{ data: SuccessStory }>('/admin/success-stories', payload);
  return response.data.data;
}

export async function updateSuccessStory(id: string, payload: Partial<SuccessStoryPayload>): Promise<SuccessStory> {
  const response = await apiClient.put<{ data: SuccessStory }>(`/admin/success-stories/${id}`, payload);
  return response.data.data;
}

export async function deleteSuccessStory(id: string): Promise<void> {
  await apiClient.delete(`/admin/success-stories/${id}`);
}

export async function uploadSuccessStoryAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await apiClient.post<{ url: string }>('/admin/success-stories/upload-avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}
