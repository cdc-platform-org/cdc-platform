import apiClient from './apiClient';
import { AdminRole } from '../types/auth';
import {
  DashboardStats,
  ModeratedListing,
  AdminTransaction,
  BogSettings,
  UpdateBogSettingsPayload,
  TeamMember,
} from '../types/adminPanel';

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>('/admin-panel/dashboard-stats');
  return response.data;
}

// --- Gigs & Vacancies moderation ---
export async function getListings(params?: {
  type?: 'gig' | 'vacancy';
  moderationStatus?: 'approved' | 'removed';
}): Promise<ModeratedListing[]> {
  const response = await apiClient.get<{ data: ModeratedListing[] }>('/admin-panel/listings', { params });
  return response.data.data;
}

export async function moderateGig(gigId: string, reason?: string): Promise<void> {
  await apiClient.post(`/admin-panel/gigs/${gigId}/moderate`, { reason });
}

export async function restoreGig(gigId: string): Promise<void> {
  await apiClient.post(`/admin-panel/gigs/${gigId}/restore`);
}

export async function moderateVacancy(vacancyId: string, reason?: string): Promise<void> {
  await apiClient.post(`/admin-panel/vacancies/${vacancyId}/moderate`, { reason });
}

export async function restoreVacancy(vacancyId: string): Promise<void> {
  await apiClient.post(`/admin-panel/vacancies/${vacancyId}/restore`);
}

// --- Financials & BOG (SUPER_ADMIN only) ---
export async function getTransactions(
  page = 1,
  pageSize = 25
): Promise<{ data: AdminTransaction[]; totalCount: number }> {
  const response = await apiClient.get('/admin-panel/financials/transactions', { params: { page, pageSize } });
  return response.data;
}

export async function getBogSettings(): Promise<BogSettings | null> {
  const response = await apiClient.get<{ data: BogSettings | null }>('/admin-panel/bog-settings');
  return response.data.data;
}

export async function updateBogSettings(payload: UpdateBogSettingsPayload): Promise<BogSettings> {
  const response = await apiClient.put<{ data: BogSettings }>('/admin-panel/bog-settings', payload);
  return response.data.data;
}

// --- Team & Permissions (SUPER_ADMIN only) ---
export async function getTeam(): Promise<TeamMember[]> {
  const response = await apiClient.get<{ data: TeamMember[] }>('/admin-panel/team');
  return response.data.data;
}

export async function addTeamMember(email: string, adminRole: AdminRole): Promise<TeamMember> {
  const response = await apiClient.post<{ data: TeamMember }>('/admin-panel/team', { email, adminRole });
  return response.data.data;
}

export async function updateTeamMemberRole(userId: string, adminRole: AdminRole): Promise<TeamMember> {
  const response = await apiClient.put<{ data: TeamMember }>(`/admin-panel/team/${userId}`, { adminRole });
  return response.data.data;
}

export async function removeTeamMember(userId: string): Promise<void> {
  await apiClient.delete(`/admin-panel/team/${userId}`);
}
