import apiClient from './apiClient';

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
  price: number; // major-unit GEL from the admin form
  category: string;
  imageUrl: string;
  fileUrl: string;
}

export async function createProduct(payload: CreateProductPayload): Promise<DigitalProduct> {
  const response = await apiClient.post<{ data: DigitalProduct }>('/admin/products', payload);
  return response.data.data;
}
