import apiClient from './apiClient';
import { ForumCategory, ForumThread, ForumComment, PaginatedResult } from '../types/forum';

// --- Categories ---
export async function getCategories(): Promise<ForumCategory[]> {
  const response = await apiClient.get<ForumCategory[]>('/forum/categories');
  return response.data;
}

// --- Threads ---
export interface ThreadFilters {
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export async function getThreads(filters?: ThreadFilters): Promise<PaginatedResult<ForumThread>> {
  const response = await apiClient.get<PaginatedResult<ForumThread>>('/forum/threads', {
    params: filters,
  });
  return response.data;
}

export async function getThreadById(threadId: string): Promise<ForumThread> {
  const response = await apiClient.get<ForumThread>(`/forum/threads/${threadId}`);
  return response.data;
}

export type CreateThreadPayload = Pick<ForumThread, 'categoryId' | 'title' | 'content'>;

export async function createThread(payload: CreateThreadPayload): Promise<ForumThread> {
  const response = await apiClient.post<ForumThread>('/forum/threads', payload);
  return response.data;
}

export async function likeThread(threadId: string): Promise<ForumThread> {
  const response = await apiClient.post<ForumThread>(`/forum/threads/${threadId}/like`);
  return response.data;
}

export async function unlikeThread(threadId: string): Promise<ForumThread> {
  const response = await apiClient.delete<ForumThread>(`/forum/threads/${threadId}/like`);
  return response.data;
}

// --- Moderation (Mentor / SuperAdmin only) ---
export async function pinThread(threadId: string): Promise<ForumThread> {
  const response = await apiClient.post<ForumThread>(`/forum/threads/${threadId}/pin`);
  return response.data;
}

export async function unpinThread(threadId: string): Promise<ForumThread> {
  const response = await apiClient.delete<ForumThread>(`/forum/threads/${threadId}/pin`);
  return response.data;
}

export async function lockThread(threadId: string): Promise<ForumThread> {
  const response = await apiClient.post<ForumThread>(`/forum/threads/${threadId}/lock`);
  return response.data;
}

export async function unlockThread(threadId: string): Promise<ForumThread> {
  const response = await apiClient.delete<ForumThread>(`/forum/threads/${threadId}/lock`);
  return response.data;
}

export async function deleteThread(threadId: string): Promise<void> {
  await apiClient.delete(`/forum/threads/${threadId}`);
}

// --- Comments ---
export interface CommentFilters {
  page?: number;
  pageSize?: number;
}

export async function getComments(
  threadId: string,
  filters?: CommentFilters
): Promise<PaginatedResult<ForumComment>> {
  const response = await apiClient.get<PaginatedResult<ForumComment>>(
    `/forum/threads/${threadId}/comments`,
    { params: filters }
  );
  return response.data;
}

export async function createComment(
  threadId: string,
  content: string
): Promise<ForumComment> {
  const response = await apiClient.post<ForumComment>(
    `/forum/threads/${threadId}/comments`,
    { content }
  );
  return response.data;
}

export async function likeComment(commentId: string): Promise<ForumComment> {
  const response = await apiClient.post<ForumComment>(`/forum/comments/${commentId}/like`);
  return response.data;
}

export async function unlikeComment(commentId: string): Promise<ForumComment> {
  const response = await apiClient.delete<ForumComment>(`/forum/comments/${commentId}/like`);
  return response.data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/forum/comments/${commentId}`);
}