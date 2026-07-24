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

// Reuses the blog module's image upload endpoint (local disk storage under
// Backend/public/uploads, served at /uploads/<file>) — it's already a
// generic, admin-gated image upload with no blog-specific behavior, so a
// second endpoint would just be duplication. Used by CMS image pickers
// (e.g. the homepage HEKS/EPER card) to let admins swap photos without
// touching code.
export async function uploadCmsImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ url: string }>('/blog/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.url;
}
