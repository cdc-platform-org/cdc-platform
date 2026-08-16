import apiClient from './apiClient';
import { SuccessStory } from '../types/successStory';

// English falls back to the Georgian (primary) field whenever a story has
// no translation set yet — same pattern as studioCaseService.ts's
// studioCaseTitle/Description/FullStory, used by the public
// /success-stories pages.
export function successStoryRoleTitle(item: SuccessStory, lang: 'ka' | 'en'): string {
  return (lang === 'en' && item.roleTitleEn) || item.roleTitle;
}
export function successStoryTestimonial(item: SuccessStory, lang: 'ka' | 'en'): string {
  return (lang === 'en' && item.testimonialEn) || item.testimonial;
}
export function successStoryContent(item: SuccessStory, lang: 'ka' | 'en'): string | null {
  return (lang === 'en' && item.storyContentEn) || item.storyContent;
}

// Public — GET /api/v1/success-stories. Pass featured=true for the
// homepage/course-page carousel (only isFeatured stories); omit for the
// /success-stories grid page and the admin list, which need every story.
export async function getSuccessStories(featured?: boolean): Promise<SuccessStory[]> {
  const response = await apiClient.get<{ data: SuccessStory[] }>('/v1/success-stories', {
    params: featured ? { featured: 'true' } : undefined,
  });
  return response.data.data;
}

export async function getSuccessStoryBySlug(slug: string): Promise<SuccessStory> {
  const response = await apiClient.get<{ data: SuccessStory }>(`/v1/success-stories/${slug}`);
  return response.data.data;
}

export interface SuccessStoryPayload {
  studentName: string;
  roleTitle: string;
  roleTitleEn?: string | null;
  courseName: string;
  testimonial: string;
  testimonialEn?: string | null;
  storyContent?: string | null;
  storyContentEn?: string | null;
  avatarUrl?: string | null;
  galleryImages?: string[];
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  hiredBy?: string | null;
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

export async function uploadSuccessStoryGalleryImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ url: string }>('/admin/success-stories/upload-gallery-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}

export interface TranslateSuccessStoryResult {
  roleTitleEn: string;
  testimonialEn: string;
  storyContentEn?: string;
}

// Gemini-backed — see Backend's POST /api/ai/translate-success-story. Admin-only.
export async function translateSuccessStory(payload: {
  roleTitle: string;
  testimonial: string;
  storyContent?: string;
}): Promise<TranslateSuccessStoryResult> {
  const response = await apiClient.post<{ data: TranslateSuccessStoryResult }>('/ai/translate-success-story', payload);
  return response.data.data;
}
