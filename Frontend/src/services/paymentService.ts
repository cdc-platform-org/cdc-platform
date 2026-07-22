import apiClient from './apiClient';

export type BogPaymentPurpose = 'COURSE' | 'MENTORSHIP' | 'GIG_ESCROW_FUNDING';
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

export async function checkoutCourse(courseId: string): Promise<BogCheckoutResult> {
  const response = await apiClient.post<BogCheckoutResult>(`/payments/checkout/course/${courseId}`);
  return response.data;
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

export async function getBogPaymentStatus(paymentId: string): Promise<BogPaymentStatusData> {
  const response = await apiClient.get<{ data: BogPaymentStatusData }>(`/payments/bog/status/${paymentId}`);
  return response.data.data;
}
