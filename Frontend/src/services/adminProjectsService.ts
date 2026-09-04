import apiClient from './apiClient';
import { Project, ProjectStatus } from '../types/project';

export async function getAdminProjects(): Promise<Project[]> {
  const response = await apiClient.get<{ data: Project[] }>('/admin/projects');
  return response.data.data;
}

export interface ProjectPayload {
  title: string;
  date: string;
  location?: string | null;
  shortDescription: string;
  fullContent: string;
  coverImage: string;
  galleryImages: string[];
  status: ProjectStatus;
}

export async function createProject(payload: ProjectPayload): Promise<Project> {
  const response = await apiClient.post<{ data: Project }>('/admin/projects', payload);
  return response.data.data;
}

export async function updateProject(id: string, payload: Partial<ProjectPayload>): Promise<Project> {
  const response = await apiClient.put<{ data: Project }>(`/admin/projects/${id}`, payload);
  return response.data.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/admin/projects/${id}`);
}

// AI Vision Builder — uploads raw photos + notes, gets back a structured
// draft (title/date/location/shortDescription/fullContent) plus the
// already-uploaded coverImage/galleryImages URLs, for review before Save.
export interface AiProjectDraft {
  title: string;
  date: string;
  location: string | null;
  shortDescription: string;
  fullContent: string;
  coverImage: string;
  galleryImages: string[];
}

export async function parseProjectFromPhotos(photos: File[], notes: string): Promise<AiProjectDraft> {
  const formData = new FormData();
  photos.forEach((file) => formData.append('photos', file));
  formData.append('notes', notes);
  const response = await apiClient.post<{ data: AiProjectDraft }>('/admin/projects/ai-builder/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120 * 1000,
  });
  return response.data.data;
}
