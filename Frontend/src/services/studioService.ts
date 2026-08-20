import apiClient from './apiClient';
import { StudioInquiry, CreateStudioInquiryPayload, UpdateStudioInquiryPayload } from '../types/studio';

export async function submitStudioInquiry(payload: CreateStudioInquiryPayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ data: { id: string } }>('/studio/inquiries', payload);
  return response.data.data;
}

export async function getStudioInquiries(status?: string): Promise<StudioInquiry[]> {
  const response = await apiClient.get<{ data: StudioInquiry[] }>('/admin/studio', { params: { status } });
  return response.data.data;
}

export async function updateStudioInquiry(id: string, payload: UpdateStudioInquiryPayload): Promise<StudioInquiry> {
  const response = await apiClient.patch<{ data: StudioInquiry }>(`/admin/studio/${id}`, payload);
  return response.data.data;
}

export async function deleteStudioInquiry(id: string): Promise<void> {
  await apiClient.delete(`/admin/studio/${id}`);
}
