import apiClient from './apiClient';
import { ProductReview, ProductReviewsSummary, SellerReviewsSummary, AdminProductReview } from '../types/productReview';

export interface CreateProductReviewPayload {
  productId: string;
  rating: number;
  comment: string;
  images?: string[]; // up to 3
}

export async function uploadProductReviewImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: { url: string } }>('/product-reviews/upload-image', formData);
  return response.data.data.url;
}

export async function createProductReview(payload: CreateProductReviewPayload): Promise<ProductReview> {
  const response = await apiClient.post<{ data: ProductReview }>('/product-reviews', payload);
  return response.data.data;
}

export async function getProductReviews(productId: string): Promise<ProductReviewsSummary> {
  const response = await apiClient.get<{ data: ProductReviewsSummary }>(`/product-reviews/product/${productId}`);
  return response.data.data;
}

export async function getSellerReviews(sellerId: string): Promise<SellerReviewsSummary> {
  const response = await apiClient.get<{ data: SellerReviewsSummary }>(`/product-reviews/seller/${sellerId}`);
  return response.data.data;
}

export async function toggleReviewHelpful(reviewId: string): Promise<{ helpfulCount: number; helpfulVoted: boolean }> {
  const response = await apiClient.post<{ data: { helpfulCount: number; helpfulVoted: boolean } }>(`/product-reviews/${reviewId}/helpful`);
  return response.data.data;
}

export async function getAdminProductReviews(): Promise<AdminProductReview[]> {
  const response = await apiClient.get<{ data: AdminProductReview[] }>('/admin/product-reviews');
  return response.data.data;
}

export async function deleteAdminProductReview(id: string): Promise<void> {
  await apiClient.delete(`/admin/product-reviews/${id}`);
}
