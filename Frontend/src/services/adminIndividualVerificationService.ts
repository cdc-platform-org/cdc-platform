// Admin API for INDIVIDUAL identity verifications (Backend:
// routes/admin/adminVerifications.ts, /api/admin/individual-verifications).
// Shown together with company submissions in the single employer-verification
// queue (pages/admin/companies.tsx).
import apiClient from './apiClient';

export interface IndividualVerificationRow {
  id: string;
  name: string;
  email: string;
  role: string;
  nationalId: string | null;
  verificationDocUrl: string | null;
  verificationLevel: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export async function getIndividualVerifications(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<IndividualVerificationRow[]> {
  return (await apiClient.get<{ data: IndividualVerificationRow[] }>('/admin/individual-verifications', { params: status ? { status } : undefined })).data.data;
}
export async function resolveIndividualDocument(id: string): Promise<string> {
  return (await apiClient.get<{ data: { url: string } }>(`/admin/individual-verifications/${encodeURIComponent(id)}/document`)).data.data.url;
}
export async function approveIndividual(id: string): Promise<IndividualVerificationRow> {
  return (await apiClient.post<{ data: IndividualVerificationRow }>(`/admin/individual-verifications/${encodeURIComponent(id)}/approve`)).data.data;
}
export async function rejectIndividual(id: string, reason: string): Promise<IndividualVerificationRow> {
  return (await apiClient.post<{ data: IndividualVerificationRow }>(`/admin/individual-verifications/${encodeURIComponent(id)}/reject`, { reason })).data.data;
}
