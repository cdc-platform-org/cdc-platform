// API client for the design editor — buyer side (/api/designs) and the
// admin template endpoints (/api/admin/product-templates). Backend:
// Backend/src/routes/designs.ts and routes/admin/adminProductTemplates.ts.
import apiClient from './apiClient';
import type { DesignTemplate } from '../types/designTemplate';

export interface EditableProduct {
  id: string;
  title: string;
  titleEn: string | null;
  imageUrl: string;
  category: string;
  designs: { id: string; title: string; updatedAt: string }[];
}

export interface DesignRecord {
  id: string;
  title: string;
  productId: string;
  data: DesignTemplate;
  templateVersion: number;
  updatedAt: string;
}

export async function getEditableProducts(): Promise<EditableProduct[]> {
  const { data } = await apiClient.get('/designs/products');
  return data.data;
}

export async function createDesign(productId: string): Promise<string> {
  const { data } = await apiClient.post('/designs', { productId });
  return data.data.id;
}

export async function getDesign(id: string): Promise<DesignRecord> {
  const { data } = await apiClient.get(`/designs/${id}`);
  return data.data;
}

export async function saveDesign(id: string, design: DesignTemplate, title?: string): Promise<{ updatedAt: string }> {
  const { data } = await apiClient.put(`/designs/${id}`, { data: design, ...(title ? { title } : {}) });
  return data.data;
}

export async function resetDesign(id: string): Promise<DesignTemplate> {
  const { data } = await apiClient.post(`/designs/${id}/reset`);
  return data.data.data;
}

export async function deleteDesign(id: string): Promise<void> {
  await apiClient.delete(`/designs/${id}`);
}

export async function uploadDesignImage(id: string, file: File): Promise<{ ref: string; width: number; height: number }> {
  const form = new FormData();
  form.append('image', file);
  const { data } = await apiClient.post(`/designs/${id}/assets`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.data;
}

// Images are fetched through the API (auth + same-origin bytes), so the
// canvas never gets "tainted" and export keeps working.
export async function fetchDesignImage(id: string, ref: string): Promise<Blob> {
  const { data } = await apiClient.get(`/designs/${id}/assets`, { params: { ref }, responseType: 'blob' });
  return data;
}

// ---- admin ----
export async function getProductTemplate(productId: string): Promise<{ data: DesignTemplate; version: number } | null> {
  try {
    const { data } = await apiClient.get(`/admin/product-templates/${productId}`);
    return data.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } }).response?.status === 404) return null;
    throw error;
  }
}

export async function putProductTemplate(productId: string, template: unknown): Promise<{ version: number }> {
  const { data } = await apiClient.put(`/admin/product-templates/${productId}`, template);
  return data.data;
}

export async function deleteProductTemplate(productId: string): Promise<void> {
  await apiClient.delete(`/admin/product-templates/${productId}`);
}
