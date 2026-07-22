import apiClient from './apiClient';
import { BlogPost } from '../types/blog';

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
