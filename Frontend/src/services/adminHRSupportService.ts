import apiClient from './apiClient';
import { HRSupportPersonRef, HRSupportRequest } from '../types/hrSupport';

export async function getAllHRSupportRequests(): Promise<HRSupportRequest[]> {
  const response = await apiClient.get<HRSupportRequest[]>('/admin/hr-support');
  return response.data;
}

export async function getHRSpecialists(): Promise<HRSupportPersonRef[]> {
  const response = await apiClient.get<HRSupportPersonRef[]>('/admin/hr-support/specialists');
  return response.data;
}

export async function assignHRSpecialist(requestId: string, specialistId: string): Promise<HRSupportRequest> {
  const response = await apiClient.post<HRSupportRequest>(`/admin/hr-support/${requestId}/assign`, { specialistId });
  return response.data;
}

export async function resolveHRSupportDispute(
  requestId: string,
  resolution: 'RELEASE' | 'REFUND'
): Promise<HRSupportRequest> {
  const response = await apiClient.post<HRSupportRequest>(`/admin/hr-support/${requestId}/dispute/resolve`, { resolution });
  return response.data;
}
