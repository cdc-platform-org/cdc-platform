import apiClient from './apiClient';
import { LiveTraining, LiveTrainingLead, LiveTrainingLeadStatus } from '../types/liveTraining';

export async function getAdminLiveTrainings(): Promise<LiveTraining[]> {
  const response = await apiClient.get<{ data: LiveTraining[] }>('/admin/live-trainings');
  return response.data.data;
}

export interface LiveTrainingPayload {
  title: string;
  description: string;
  category: string;
  scheduledAt: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  price?: number | null;
  thumbnailUrl?: string;
  minCapacity?: number;
  maxCapacity: number;
  published?: boolean;
}

export async function createLiveTraining(payload: LiveTrainingPayload): Promise<LiveTraining> {
  const response = await apiClient.post<{ data: LiveTraining }>('/admin/live-trainings', payload);
  return response.data.data;
}

export async function updateLiveTraining(id: string, payload: Partial<LiveTrainingPayload>): Promise<LiveTraining> {
  const response = await apiClient.put<{ data: LiveTraining }>(`/admin/live-trainings/${id}`, payload);
  return response.data.data;
}

export async function deleteLiveTraining(id: string): Promise<void> {
  await apiClient.delete(`/admin/live-trainings/${id}`);
}

export async function getLiveTrainingLeads(trainingId: string): Promise<LiveTrainingLead[]> {
  const response = await apiClient.get<{ data: LiveTrainingLead[] }>(`/admin/live-trainings/${trainingId}/leads`);
  return response.data.data;
}

export async function updateLiveTrainingLead(
  leadId: string,
  payload: { status?: LiveTrainingLeadStatus; adminNote?: string | null }
): Promise<LiveTrainingLead> {
  const response = await apiClient.patch<{ data: LiveTrainingLead }>(`/admin/live-trainings/leads/${leadId}`, payload);
  return response.data.data;
}

// Same blob-download pattern as billingService.downloadSubscriptionInvoice —
// the caller creates an object URL and clicks a throwaway <a download>.
export async function exportLiveTrainingLeadsCsv(trainingId: string): Promise<Blob> {
  const response = await apiClient.get(`/admin/live-trainings/${trainingId}/leads/export`, { responseType: 'blob' });
  return response.data;
}
