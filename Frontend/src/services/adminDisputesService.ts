import apiClient from './apiClient';

interface DisputeUser {
  id: string;
  name: string;
  email: string;
}

interface DisputeGig {
  id: string;
  title: string;
  description?: string;
  status: string;
  deliveryComment: string | null;
  deliveryFiles: string[];
  deliveryLinks: string[];
  postedBy: DisputeUser;
  assignedFreelancer: DisputeUser | null;
  transaction: {
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    currency: string;
    status: string;
  } | null;
}

export interface DisputeRow {
  id: string;
  gigId: string;
  gig: DisputeGig;
  raisedById: string;
  raisedBy: DisputeUser;
  reason: string;
  status: 'OPEN' | 'RESOLVED_REFUND' | 'RESOLVED_PAYOUT' | 'DISMISSED';
  resolution: string | null;
  resolvedBy: DisputeUser | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface DisputeDetail extends DisputeRow {
  messages: { id: string; senderId: string; recipientId: string; content: string; wasFiltered: boolean; createdAt: string }[];
}

export async function getDisputes(status?: string): Promise<DisputeRow[]> {
  const response = await apiClient.get<{ data: DisputeRow[] }>('/admin/disputes', { params: { status } });
  return response.data.data;
}

export async function getDispute(id: string): Promise<DisputeDetail> {
  const response = await apiClient.get<{ data: DisputeDetail }>(`/admin/disputes/${id}`);
  return response.data.data;
}

export async function resolveDispute(
  id: string,
  status: 'RESOLVED_REFUND' | 'RESOLVED_PAYOUT' | 'DISMISSED',
  resolution?: string
): Promise<DisputeRow> {
  const response = await apiClient.post<{ data: DisputeRow }>(`/admin/disputes/${id}/resolve`, { status, resolution });
  return response.data.data;
}
