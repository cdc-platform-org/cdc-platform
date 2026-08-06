import apiClient from './apiClient';
import { BlogPost, BlogComment } from '../types/blog';

// Canonical "Success Stories" category label — a post is treated as a
// graduate success story purely by category match (no separate boolean
// field), so the badge/filter work for posts tagged in either language.
export const SUCCESS_STORIES_CATEGORY_KA = 'წარმატებული ისტორიები';
export const SUCCESS_STORIES_CATEGORY_EN = 'Success Stories';

export function isSuccessStory(post: BlogPost): boolean {
  const category = post.category.trim().toLowerCase();
  return category === SUCCESS_STORIES_CATEGORY_KA.toLowerCase() || category === SUCCESS_STORIES_CATEGORY_EN.toLowerCase();
}

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

// Accepts either the post's id or its slug — the backend route resolves
// whichever was passed (see Backend's routes/blog.ts).
export async function getBlogPostById(idOrSlug: string): Promise<BlogPost> {
  const response = await apiClient.get<{ data: BlogPost }>(`/blog/${idOrSlug}`);
  return response.data.data;
}

// Estimate only — no separate stored field, computed the same way every
// time it's needed (~200 words/minute, matches common blog conventions).
// Strips HTML tags first — content can be either Markdown (human-authored,
// via RichTextEditor) or HTML (AI-generated, via aiAgentService.ts), and
// raw tags/attributes would otherwise inflate the word count for the latter.
export function estimateReadingMinutes(content: string): number {
  const words = content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function getBlogComments(idOrSlug: string): Promise<BlogComment[]> {
  const response = await apiClient.get<{ data: BlogComment[] }>(`/blog/${idOrSlug}/comments`);
  return response.data.data;
}

export async function createBlogComment(idOrSlug: string, payload: { content: string; parentId?: string | null }): Promise<BlogComment> {
  const response = await apiClient.post<{ data: BlogComment }>(`/blog/${idOrSlug}/comments`, payload);
  return response.data.data;
}

export async function deleteBlogComment(commentId: string): Promise<void> {
  await apiClient.delete(`/blog/comments/${commentId}`);
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

export interface GeneratedBlogDraft {
  title: string;
  description: string;
  content: string;
  category: string;
  titleEn: string;
  descriptionEn: string;
  contentEn: string;
  imageUrl: string;
}

// CDC Autonomous Operations Agent — Gemini-backed, see Backend's
// POST /api/admin/blog/generate-ai. Admin-only. Returns generated fields
// for the admin to review/edit; does not create a post by itself. `topic`
// is optional — omit to let the agent pick a current AI/tech topic itself.
export async function generateBlogPostWithAi(topic?: string): Promise<GeneratedBlogDraft> {
  const response = await apiClient.post<{ data: GeneratedBlogDraft }>('/admin/blog/generate-ai', { topic });
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
