import apiClient from './apiClient';

// Mirrors services/businessKycService.ts's BusinessDocumentParseResult on
// the Backend — the structured AI extraction, shown in the admin
// inspection drawer's extracted-vs-entered comparison.
export interface BusinessKycExtractedData {
  hasOfficialHeaders: boolean;
  companyName: string | null;
  identificationCode: string | null;
  registrationDate: string | null;
  registryAuthority: string | null;
  activeStatus: 'ACTIVE' | 'LIQUIDATION' | 'INSOLVENCY' | 'RESTRAINED' | 'UNKNOWN';
  directors: { name: string; personalId: string | null }[];
  confidenceScore: number;
  reasoning: string;
}

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
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  trialStartDate: string | null;
  aiTrialEndsAt: string | null;
  aiSubscriptionActive: boolean;
  createdAt: string;
  businessKycExtractedData: BusinessKycExtractedData | null;
  businessKycScore: number | null;
  businessKycReasoning: string | null;
  businessKycCheckedAt: string | null;
  businessKycRejectionReason: string | null;
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

export async function rejectCompany(id: string, reason: string): Promise<CompanyRow> {
  const response = await apiClient.post<{ data: CompanyRow }>(`/admin/companies/${id}/reject`, { reason });
  return response.data.data;
}

export type AiTrialUpdatePayload =
  | { mode: 'extend'; days: number }
  | { mode: 'set'; date: string }
  | { mode: 'unlimited' };

export interface TaxIdLimit {
  taxId: string;
  maxAccounts: number | null;
  isDefault: boolean;
  accountCount: number;
}

export async function getTaxIdLimit(taxId: string): Promise<TaxIdLimit> {
  const response = await apiClient.get<{ data: TaxIdLimit }>(`/admin/companies/tax-id-limit/${encodeURIComponent(taxId)}`);
  return response.data.data;
}

// maxAccounts: null explicitly removes the cap (unlimited).
export async function setTaxIdLimit(taxId: string, maxAccounts: number | null): Promise<void> {
  await apiClient.put(`/admin/companies/tax-id-limit/${encodeURIComponent(taxId)}`, { maxAccounts });
}

// Reverts to the platform default — distinct from setTaxIdLimit(taxId, null),
// which explicitly sets "no limit."
export async function resetTaxIdLimit(taxId: string): Promise<void> {
  await apiClient.delete(`/admin/companies/tax-id-limit/${encodeURIComponent(taxId)}`);
}

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
