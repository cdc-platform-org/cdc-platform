import apiClient from './apiClient';
import { GrantOpportunity, GrantSource, GrantEligibilityStatus, ScanSummary } from '../types/opportunity';

export async function getOpportunities(filters?: { eligibilityStatus?: GrantEligibilityStatus; includeArchived?: boolean; sourceId?: string }): Promise<GrantOpportunity[]> {
  const response = await apiClient.get<{ data: GrantOpportunity[] }>('/admin/opportunities', { params: filters });
  return response.data.data;
}

export async function updateOpportunity(
  id: string,
  patch: { eligibilityStatus?: GrantEligibilityStatus; isArchived?: boolean; archivedReason?: string | null }
): Promise<GrantOpportunity> {
  const response = await apiClient.patch<{ data: GrantOpportunity }>(`/admin/opportunities/${id}`, patch);
  return response.data.data;
}

export async function rescanOpportunities(): Promise<ScanSummary & { message: string }> {
  const response = await apiClient.post<ScanSummary & { message: string }>('/admin/opportunities/rescan');
  return response.data;
}

export async function getGrantSources(): Promise<GrantSource[]> {
  const response = await apiClient.get<{ data: GrantSource[] }>('/admin/opportunities/sources/all');
  return response.data.data;
}

export interface GrantSourcePayload {
  name: string;
  baseUrl: string;
  listingUrls: string[];
  isActive?: boolean;
}

export async function createGrantSource(payload: GrantSourcePayload): Promise<GrantSource> {
  const response = await apiClient.post<{ data: GrantSource }>('/admin/opportunities/sources', payload);
  return response.data.data;
}

export async function updateGrantSource(id: string, payload: Partial<GrantSourcePayload>): Promise<GrantSource> {
  const response = await apiClient.patch<{ data: GrantSource }>(`/admin/opportunities/sources/${id}`, payload);
  return response.data.data;
}

export async function deleteGrantSource(id: string): Promise<void> {
  await apiClient.delete(`/admin/opportunities/sources/${id}`);
}
