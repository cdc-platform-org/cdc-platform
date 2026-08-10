import apiClient from './apiClient';

export interface CompanyRow {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  industry: string | null;
  websiteUrl: string | null;
  companyDescription: string | null;
  avatarUrl: string | null;
  phone: string | null;
  taxId: string | null;
  verificationDocUrl: string | null;
  isVerified: boolean;
  verificationStatus: 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | null;
  trialStartDate: string | null;
  aiTrialEndsAt: string | null;
  aiSubscriptionActive: boolean;
  createdAt: string;
}

export async function getCompanies(status?: 'unverified' | 'under_review' | 'verified' | 'pending' | 'rejected'): Promise<CompanyRow[]> {
  const response = await apiClient.get<{ data: CompanyRow[] }>('/admin/companies', { params: { status } });
  return response.data.data;
}

export async function verifyCompany(id: string): Promise<CompanyRow> {
  const response = await apiClient.post<{ data: CompanyRow }>(`/admin/companies/${id}/verify`);
  return response.data.data;
}

export async function unverifyCompany(id: string): Promise<CompanyRow> {
  const response = await apiClient.post<{ data: CompanyRow }>(`/admin/companies/${id}/unverify`);
  return response.data.data;
}

export async function rejectCompany(id: string): Promise<CompanyRow> {
  const response = await apiClient.post<{ data: CompanyRow }>(`/admin/companies/${id}/reject`);
  return response.data.data;
}

export type AiTrialUpdatePayload =
  | { mode: 'extend'; days: number }
  | { mode: 'set'; date: string }
  | { mode: 'unlimited' };

export async function updateAiTrial(
  userId: string,
  payload: AiTrialUpdatePayload
): Promise<{ id: string; aiTrialEndsAt: string | null; aiSubscriptionActive: boolean }> {
  const response = await apiClient.patch<{ data: { id: string; aiTrialEndsAt: string | null; aiSubscriptionActive: boolean } }>(
    `/admin/users/${userId}/ai-trial`,
    payload
  );
  return response.data.data;
}
