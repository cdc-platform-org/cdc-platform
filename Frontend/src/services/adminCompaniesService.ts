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
  createdAt: string;
}

export async function getCompanies(status?: 'unverified' | 'under_review' | 'verified'): Promise<CompanyRow[]> {
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
