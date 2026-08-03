import apiClient from './apiClient';

export type BogPaymentPurpose = 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING' | 'PRODUCT';
export type BogPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BogCheckoutResult {
  paymentId: string;
  redirectUrl: string;
}

export interface BogPaymentStatusData {
  id: string;
  status: BogPaymentStatus;
  purpose: BogPaymentPurpose;
  referenceId: string;
  amount: number;
  currency: string;
}

export async function checkoutCourse(courseId: string, promoCode?: string): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>(`/payments/checkout/course/${courseId}`, promoCode ? { promoCode } : undefined);
  return response.data;
}

export interface PromoValidationResult {
  code: string;
  discountPercent: number | null;
  discountAmount: number | null;
  originalAmount: number;
  discountedAmount: number;
}

export async function validatePromoCode(code: string, courseId: string): Promise<PromoValidationResult> {
  const response = await apiClient.post<{ data: PromoValidationResult }>('/promos/validate', { code, courseId });
  return response.data.data;
}

export async function checkoutMentorship(params: {
  mentorId: string;
  amount: number;
  currency?: 'GEL' | 'USD' | 'EUR' | 'GBP';
  note?: string;
}): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>('/payments/checkout/mentorship', params);
  return response.data;
}

export async function checkoutGigEscrow(gigId: string): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>(`/payments/checkout/gig/${gigId}`);
  return response.data;
}

export async function checkoutProduct(productId: string): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>(`/payments/checkout/product/${productId}`);
  return response.data;
}

export async function getBogPaymentStatus(paymentId: string): Promise<BogPaymentStatusData> {
  const response = await apiClient.get<{ data: BogPaymentStatusData }>(`/payments/bog/status/${paymentId}`);
  return response.data.data;
}

export interface MyPaymentRow {
  id: string;
  purpose: BogPaymentPurpose;
  referenceId: string;
  // Resolved course title for COURSE purchases — null for the other two
  // purposes (mentorship's referenceId is already a free-text label; gig
  // escrow funding is already covered in full by the dashboard's Gigs tab).
  referenceTitle: string | null;
  amount: number;
  currency: string;
  status: BogPaymentStatus | 'REFUNDED';
  createdAt: string;
  completedAt: string | null;
}

export async function getMyPayments(): Promise<MyPaymentRow[]> {
  const response = await apiClient.get<{ data: MyPaymentRow[] }>('/payments/my');
  return response.data.data;
}
