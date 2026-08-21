import apiClient from './apiClient';
import { TeamMember, TeamMemberType } from '../types/teamMember';

// Public — GET /api/team (all active members) or GET /api/trainers (active
// TRAINER-type members only), for the homepage team block and /trainers page.
export async function getTeamMembers(type?: TeamMemberType): Promise<TeamMember[]> {
  const response = await apiClient.get<{ data: TeamMember[] }>('/team', {
    params: type ? { type } : undefined,
  });
  return response.data.data;
}

export async function getTrainers(): Promise<TeamMember[]> {
  const response = await apiClient.get<{ data: TeamMember[] }>('/trainers');
  return response.data.data;
}

export interface TeamMemberPayload {
  name: string;
  role: string;
  bio?: string | null;
  nameEn?: string | null;
  roleEn?: string | null;
  bioEn?: string | null;
  imageUrl?: string | null;
  profileUrl?: string | null;
  type: TeamMemberType;
  order?: number;
  active?: boolean;
}

export async function adminGetTeamMembers(): Promise<TeamMember[]> {
  const response = await apiClient.get<{ data: TeamMember[] }>('/admin/team');
  return response.data.data;
}

export async function createTeamMember(payload: TeamMemberPayload): Promise<TeamMember> {
  const response = await apiClient.post<{ data: TeamMember }>('/admin/team', payload);
  return response.data.data;
}

export async function updateTeamMember(id: string, payload: Partial<TeamMemberPayload>): Promise<TeamMember> {
  const response = await apiClient.put<{ data: TeamMember }>(`/admin/team/${id}`, payload);
  return response.data.data;
}

export async function deleteTeamMember(id: string): Promise<void> {
  await apiClient.delete(`/admin/team/${id}`);
}

export interface TranslateTeamMemberResult {
  nameEn: string;
  roleEn: string;
  bioEn: string;
}

export async function translateTeamMember(payload: { name: string; role: string; bio: string }): Promise<TranslateTeamMemberResult> {
  const response = await apiClient.post<{ data: TranslateTeamMemberResult }>('/ai/translate-team-member', payload);
  return response.data.data;
}

export async function uploadTeamMemberPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await apiClient.post<{ url: string }>('/admin/team/upload-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}
