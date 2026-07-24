import apiClient from './apiClient';
import { ForumThread } from '../types/forum';

export interface PendingForumThread extends ForumThread {
  category: { name: string; slug: string };
}

export async function getForumQueue(): Promise<PendingForumThread[]> {
  const response = await apiClient.get<{ data: PendingForumThread[] }>('/admin/forum/queue');
  return response.data.data;
}

export async function moderateForumThread(threadId: string, status: 'APPROVED' | 'REJECTED', reason?: string): Promise<ForumThread> {
  const response = await apiClient.post<{ data: ForumThread }>(`/admin/forum/threads/${threadId}/moderate`, { status, reason });
  return response.data.data;
}

export async function adminDeleteForumThread(threadId: string): Promise<void> {
  await apiClient.delete(`/admin/forum/threads/${threadId}`);
}

export interface AdminForumCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
}

export async function getAdminForumCategories(): Promise<AdminForumCategory[]> {
  const response = await apiClient.get<{ data: AdminForumCategory[] }>('/admin/forum/categories');
  return response.data.data;
}

export async function createForumCategory(payload: { slug: string; name: string; description: string }): Promise<AdminForumCategory> {
  const response = await apiClient.post<{ data: AdminForumCategory }>('/admin/forum/categories', payload);
  return response.data.data;
}

export async function deleteForumCategory(categoryId: string): Promise<void> {
  await apiClient.delete(`/admin/forum/categories/${categoryId}`);
}
