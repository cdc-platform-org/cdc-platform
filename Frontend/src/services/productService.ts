import apiClient from './apiClient';

export type ProductStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';

export interface DigitalProduct {
  id: string;
  title: string;
  description: string;
  price: number; // minor units (tetri); 0 = free
  category: string;
  imageUrl: string;
  // Up to 4 additional showcase screenshots alongside imageUrl (the main
  // cover) — shown as a gallery/carousel on /store/[id].
  previewImages: string[];
  // Extension of the (never publicly exposed) fileUrl, e.g. "ZIP"/"PDF" —
  // safe to show as a format badge without revealing the real download link.
  fileFormat: string | null;
  downloadsCount: number;
  createdAt: string;
  purchased: boolean;
  status?: ProductStatus;
  rejectionReason?: string | null;
  // AI moderation (Backend's productModerationService.ts) — set once at
  // submission/resubmission time, never re-run automatically. Only ever
  // populated on /admin/products (adminProducts.ts's GET / returns the raw
  // row); never present on the public /products responses.
  aiReviewScore?: number | null;
  aiReviewConfidence?: number | null;
  aiReviewReasoning?: string | null;
  aiReviewedAt?: string | null;
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
  previewImages?: string[]; // up to 4
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

// Edit + resubmit the submitter's own PENDING/NEEDS_REVISION submission
// (never APPROVED — see products.ts's PUT /:id/mine). Always resets status
// back to PENDING server-side, so this doubles as "acknowledge the
// requested changes and send it back for review."
export async function updateMyProduct(id: string, payload: Partial<CreateProductPayload>): Promise<DigitalProduct> {
  const response = await apiClient.put<{ data: DigitalProduct }>(`/products/${id}/mine`, payload);
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
  imageUrl?: string;
  previewImages?: string[]; // up to 4
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

// Distinct from reject — tells the submitter what to fix and lets them
// edit + resubmit (see updateMyProduct above), rather than a final decision.
export async function requestProductChanges(id: string, feedback: string): Promise<DigitalProduct> {
  const response = await apiClient.post<{ data: DigitalProduct }>(`/admin/products/${id}/request-changes`, { feedback });
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

// Same as uploadProductImage/uploadProductFile above, but for verified
// graduates/freelancers submitting their own product (see products.ts's
// /upload-image and /upload-file — gated by canSubmitProducts, not
// SUPER_ADMIN/MANAGER like the /admin/products/* pair).
export async function uploadMyProductImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: { url: string } }>('/products/upload-image', formData);
  return response.data.data.url;
}

export async function uploadMyProductFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ data: { url: string } }>('/products/upload-file', formData);
  return response.data.data.url;
}

export interface AdminProductPurchase {
  id: string;
  amount: number;
  paymentStatus: string;
  downloadedAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

// Whether each buyer has ever actually downloaded the file — the deciding
// fact for a refund request (non-refundable once downloaded, see
// legalContent.ts's Digital Store refund clause).
export async function getProductPurchases(productId: string): Promise<AdminProductPurchase[]> {
  const response = await apiClient.get<{ data: AdminProductPurchase[] }>(`/admin/products/${productId}/purchases`);
  return response.data.data;
}
