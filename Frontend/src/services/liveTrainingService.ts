import apiClient from './apiClient';
import { LiveTraining } from '../types/liveTraining';

export async function getLiveTrainings(category?: string): Promise<LiveTraining[]> {
  const response = await apiClient.get<{ data: LiveTraining[] }>('/live-trainings', {
    params: category ? { category } : undefined,
  });
  return response.data.data;
}

export async function getLiveTraining(id: string): Promise<LiveTraining> {
  const response = await apiClient.get<{ data: LiveTraining }>(`/live-trainings/${id}`);
  return response.data.data;
}

export interface LiveTrainingRegisterPayload {
  name: string;
  email: string;
  phone: string;
}

export async function registerForLiveTraining(id: string, payload: LiveTrainingRegisterPayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ data: { id: string } }>(`/live-trainings/${id}/register`, payload);
  return response.data.data;
}
