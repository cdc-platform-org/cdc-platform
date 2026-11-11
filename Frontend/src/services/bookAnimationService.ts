import apiClient from './apiClient';

// Children's book "animated video" add-on (Backend routes/bookAnimation.ts).

export type BookAnimationState = 'PAYMENT_PENDING' | 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';

export interface BookAnimationInfo {
  id: string;
  status: BookAnimationState;
  paid: boolean;
  durationSec: number | null;
  failed: boolean;
  updatedAt: string;
  videoUrl: string | null;
  downloadUrl: string | null;
}

export interface BookAnimationStatus {
  priceTetri: number;
  promoTargetType: 'AI_TOOL';
  promoTargetId: string;
  eligible: boolean;
  devPaymentSimulation: boolean;
  soraEnabled: boolean;
  animation: BookAnimationInfo | null;
}

export interface SharedBookAnimation {
  durationSec: number | null;
  videoUrl: string | null;
  downloadUrl: string | null;
}

export async function getBookAnimation(bookId: string): Promise<BookAnimationStatus> {
  const response = await apiClient.get<{ data: BookAnimationStatus }>(`/childrens-books/${bookId}/animation`);
  return response.data.data;
}

export async function buyBookAnimation(bookId: string, options: { promoCode?: string; lang?: string } = {}): Promise<{ redirectUrl: string | null; purchased?: boolean; simulate?: boolean }> {
  const response = await apiClient.post<{ redirectUrl: string | null; purchased?: boolean; simulate?: boolean }>(`/childrens-books/${bookId}/animation`, {
    ...(options.promoCode ? { promoCode: options.promoCode } : {}),
    ...(options.lang ? { lang: options.lang } : {}),
  });
  return response.data;
}

export async function simulateBookAnimationPayment(bookId: string): Promise<BookAnimationStatus> {
  const response = await apiClient.post<{ data: BookAnimationStatus }>(`/childrens-books/${bookId}/animation/simulate-payment`);
  return response.data.data;
}

export async function retryBookAnimation(bookId: string): Promise<BookAnimationStatus> {
  const response = await apiClient.post<{ data: BookAnimationStatus }>(`/childrens-books/${bookId}/animation/retry`);
  return response.data.data;
}

export async function getSharedBookAnimation(token: string): Promise<SharedBookAnimation | null> {
  const response = await apiClient.get<{ data: SharedBookAnimation | null }>(`/childrens-books/shared/${encodeURIComponent(token)}/animation`);
  return response.data.data;
}
