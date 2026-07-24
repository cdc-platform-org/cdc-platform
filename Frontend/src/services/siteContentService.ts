import apiClient from './apiClient';

export interface SiteContentRow<T> {
  page: string;
  content: T;
  updatedAt: string;
}

export async function getSiteContent<T>(page: string): Promise<SiteContentRow<T> | null> {
  const response = await apiClient.get<{ data: SiteContentRow<T> | null }>(`/site-content/${page}`);
  return response.data.data;
}

export async function getAdminSiteContent<T>(page: string): Promise<SiteContentRow<T> | null> {
  const response = await apiClient.get<{ data: SiteContentRow<T> | null }>(`/admin/cms/${page}`);
  return response.data.data;
}

export async function updateSiteContent<T>(page: string, content: T): Promise<SiteContentRow<T>> {
  const response = await apiClient.put<{ data: SiteContentRow<T> }>(`/admin/cms/${page}`, { content });
  return response.data.data;
}
