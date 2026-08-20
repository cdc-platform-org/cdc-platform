import apiClient from './apiClient';
import { LaunchKit } from '../types/marketing';

export async function generateLaunchKit(target: { productId: string } | { courseId: string }, lang: 'ka' | 'en' = 'ka'): Promise<LaunchKit> {
  const response = await apiClient.post<{ data: LaunchKit }>('/admin/marketing/launch-kits', { ...target, lang });
  return response.data.data;
}

export async function getLaunchKits(target: { productId: string } | { courseId: string }): Promise<LaunchKit[]> {
  const response = await apiClient.get<{ data: LaunchKit[] }>('/admin/marketing/launch-kits', { params: target });
  return response.data.data;
}

export async function getAllLaunchKits(): Promise<LaunchKit[]> {
  const response = await apiClient.get<{ data: LaunchKit[] }>('/admin/marketing/launch-kits/all');
  return response.data.data;
}

export async function getLaunchKit(id: string): Promise<LaunchKit> {
  const response = await apiClient.get<{ data: LaunchKit }>(`/admin/marketing/launch-kits/${id}`);
  return response.data.data;
}

export async function deleteLaunchKit(id: string): Promise<void> {
  await apiClient.delete(`/admin/marketing/launch-kits/${id}`);
}
