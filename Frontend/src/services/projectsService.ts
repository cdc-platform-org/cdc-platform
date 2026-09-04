import apiClient from './apiClient';
import { Project } from '../types/project';

// Public showcase — PUBLISHED only.
export async function getProjects(): Promise<Project[]> {
  const response = await apiClient.get<{ data: Project[] }>('/projects');
  return response.data.data;
}

export async function getProject(id: string): Promise<Project> {
  const response = await apiClient.get<{ data: Project }>(`/projects/${id}`);
  return response.data.data;
}
