import apiClient from './apiClient';

export interface WalletEntryRow {
  id: string;
  type: 'ESCROW_RELEASE_CREDIT' | 'PAYOUT_DEBIT' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface WalletSummary {
  earningsBalance: number;
  history: { items: WalletEntryRow[]; totalCount: number; page: number; pageSize: number };
}

export async function getWalletSummary(page = 1): Promise<WalletSummary> {
  const response = await apiClient.get<WalletSummary>('/wallet/me', { params: { page } });
  return response.data;
}

export interface PayoutRequestRow {
  id: string;
  amount: number;
  iban: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// iban is optional — omit it to fall back to the student's saved
// payoutIban (see /dashboard/settings); the backend rejects the request if
// neither is present.
export async function createPayoutRequest(amount: number, iban?: string): Promise<PayoutRequestRow> {
  const response = await apiClient.post<{ data: PayoutRequestRow }>('/wallet/payout-requests', { amount, iban: iban || undefined });
  return response.data.data;
}

export async function getMyPayoutRequests(): Promise<PayoutRequestRow[]> {
  const response = await apiClient.get<{ data: PayoutRequestRow[] }>('/wallet/payout-requests');
  return response.data.data;
}
