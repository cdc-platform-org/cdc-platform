import apiClient from './apiClient';

export type ProductStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DigitalProduct {
  id: string;
  title: string;
  description: string;
  price: number; // minor units (tetri); 0 = free
  category: string;
  imageUrl: string;
  downloadsCount: number;
  createdAt: string;
  purchased: boolean;
  status?: ProductStatus;
  rejectionReason?: string | null;
}

export async function getProducts(category?: string): Promise<DigitalProduct[]> {
  const response = await apiClient.get<{ data: DigitalProduct[] }>('/products', { params: category ? { category } : undefined });
  return response.data.data;
}

export async function getProduct(id: string): Promise<DigitalProduct> {
  const response = await apiClient.get<{ data: DigitalProduct }>(`/products/${id}`);
  return response.data.data;
}

export async function claimFreeProduct(id: string): Promise<void> {
  await apiClient.post(`/products/${id}/claim`);
}

export async function getProductDownloadUrl(id: string): Promise<string> {
  const response = await apiClient.get<{ data: { fileUrl: string } }>(`/products/${id}/download`);
  return response.data.data.fileUrl;
}

export interface CreateProductPayload {
  title: string;
  description: string;
  price: number; // major-unit GEL from the form
  category: string;
  imageUrl: string;
  fileUrl: string;
}

// Admin-authored — published immediately (no moderation needed).
export async function createProduct(payload: CreateProductPayload): Promise<DigitalProduct> {
  const response = await apiClient.post<{ data: DigitalProduct }>('/admin/products', payload);
  return response.data.data;
}

// Verified-graduate/admin submission — always lands PENDING for review.
export async function submitProduct(payload: CreateProductPayload): Promise<DigitalProduct> {
  const response = await apiClient.post<{ data: DigitalProduct }>('/products', payload);
  return response.data.data;
}

export async function getMySubmissions(): Promise<DigitalProduct[]> {
  const response = await apiClient.get<{ data: DigitalProduct[] }>('/products/mine/submissions');
  return response.data.data;
}

export async function getAdminProducts(): Promise<(DigitalProduct & { submittedBy: { id: string; name: string; email: string } | null })[]> {
  const response = await apiClient.get<{ data: (DigitalProduct & { submittedBy: { id: string; name: string; email: string } | null })[] }>(
    '/admin/products'
  );
  return response.data.data;
}

export interface UpdateProductPayload {
  title?: string;
  description?: string;
  category?: string;
  price?: number; // major-unit GEL
}

export async function updateProductAdmin(id: string, payload: UpdateProductPayload): Promise<DigitalProduct> {
  const response = await apiClient.put<{ data: DigitalProduct }>(`/admin/products/${id}`, payload);
  return response.data.data;
}

export async function approveProduct(id: string): Promise<DigitalProduct> {
  const response = await apiClient.post<{ data: DigitalProduct }>(`/admin/products/${id}/approve`);
  return response.data.data;
}

export async function rejectProduct(id: string, reason: string): Promise<DigitalProduct> {
  const response = await apiClient.post<{ data: DigitalProduct }>(`/admin/products/${id}/reject`, { reason });
  return response.data.data;
}

export async function uploadProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: { url: string } }>('/admin/products/upload-image', formData);
  return response.data.data.url;
}

export async function uploadProductFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ data: { url: string } }>('/admin/products/upload-file', formData);
  return response.data.data.url;
}
