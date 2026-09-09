import apiClient from './apiClient';

export interface LiveTrainingEnrollmentRow {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
  enrolledAt: string;
  user: { id: string; name: string; email: string };
}
export interface LiveTrainingInvite {
  id: string;
  token: string;
  email: string | null;
  maxRedemptions: number;
  redemptionCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const base = (trainingId: string) => `/admin/live-trainings/${encodeURIComponent(trainingId)}`;

export async function listEnrollments(trainingId: string): Promise<LiveTrainingEnrollmentRow[]> {
  return (await apiClient.get<{ data: LiveTrainingEnrollmentRow[] }>(`${base(trainingId)}/enrollments`)).data.data;
}
export async function manualEnroll(trainingId: string, email: string): Promise<void> {
  await apiClient.post(`${base(trainingId)}/enrollments`, { email });
}
export async function cancelEnrollment(trainingId: string, userId: string): Promise<void> {
  await apiClient.delete(`${base(trainingId)}/enrollments/${encodeURIComponent(userId)}`);
}
export async function listInvites(trainingId: string): Promise<LiveTrainingInvite[]> {
  return (await apiClient.get<{ data: LiveTrainingInvite[] }>(`${base(trainingId)}/invites`)).data.data;
}
export async function createInvite(trainingId: string, input: { email?: string | null; maxRedemptions: number; expiresAt?: string | null }): Promise<LiveTrainingInvite> {
  return (await apiClient.post<{ data: LiveTrainingInvite }>(`${base(trainingId)}/invites`, input)).data.data;
}
export async function revokeInvite(trainingId: string, id: string): Promise<void> {
  await apiClient.post(`${base(trainingId)}/invites/${encodeURIComponent(id)}/revoke`);
}
export async function getInviteQr(trainingId: string, id: string): Promise<{ url: string; qrDataUrl: string }> {
  return (await apiClient.get<{ data: { url: string; qrDataUrl: string } }>(`${base(trainingId)}/invites/${encodeURIComponent(id)}/qr`)).data.data;
}
export async function redeemInvite(token: string, locale?: string): Promise<{ liveTraining: { id: string; title: string } }> {
  return (await apiClient.post<{ data: { liveTraining: { id: string; title: string } } }>(`/live-trainings/invites/${encodeURIComponent(token)}/redeem`, { locale })).data.data;
}
