import apiClient from './apiClient';
import { BlogPost } from '../types/blog';

// English falls back to the Georgian (primary) field whenever the post has
// no translation set yet — used by the public /blog pages.
export function blogTitle(post: BlogPost, lang: 'ka' | 'en'): string {
  return (lang === 'en' && post.titleEn) || post.title;
}
export function blogDescription(post: BlogPost, lang: 'ka' | 'en'): string {
  return (lang === 'en' && post.descriptionEn) || post.description;
}
export function blogContent(post: BlogPost, lang: 'ka' | 'en'): string {
  return (lang === 'en' && post.contentEn) || post.content;
}

export async function getBlogPosts(category?: string): Promise<BlogPost[]> {
  const response = await apiClient.get<{ data: BlogPost[] }>('/blog', {
    params: category ? { category } : undefined,
  });
  return response.data.data;
}

export async function getBlogPostById(id: string): Promise<BlogPost> {
  const response = await apiClient.get<{ data: BlogPost }>(`/blog/${id}`);
  return response.data.data;
}

export interface BlogPostPayload {
  title: string;
  description: string;
  category: string;
  content: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  contentEn?: string | null;
  imageUrl?: string;
  published?: boolean;
}

export async function createBlogPost(payload: BlogPostPayload): Promise<BlogPost> {
  const response = await apiClient.post<{ data: BlogPost }>('/blog', payload);
  return response.data.data;
}

export async function updateBlogPost(id: string, payload: Partial<BlogPostPayload>): Promise<BlogPost> {
  const response = await apiClient.put<{ data: BlogPost }>(`/blog/${id}`, payload);
  return response.data.data;
}

export async function deleteBlogPost(id: string): Promise<void> {
  await apiClient.delete(`/blog/${id}`);
}

export interface TranslateBlogPostResult {
  titleEn: string;
  descriptionEn: string;
  contentEn: string;
}

// Gemini-backed — see Backend's POST /api/ai/translate. Admin-only.
export async function translateBlogPost(payload: {
  title: string;
  description: string;
  content: string;
}): Promise<TranslateBlogPostResult> {
  const response = await apiClient.post<{ data: TranslateBlogPostResult }>('/ai/translate', payload);
  return response.data.data;
}

export async function uploadBlogImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ url: string }>('/blog/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}

// Locally-uploaded images come back as a server-relative path (e.g. "/uploads/x.png"),
// which needs the API's origin (not the frontend's) to resolve. External image URLs
// pasted into the form are already absolute and pass through unchanged.
export function resolveBlogImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const apiOrigin = (apiClient.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
  return `${apiOrigin}${url}`;
}
