import apiClient from './apiClient';
import { BogPaymentPurpose, BogPaymentStatus, BogPaymentBookingInfo } from './paymentService';

// International-currency (USD/EUR) counterpart to paymentService.ts's BOG
// checkout functions — same shapes/conventions, hitting /payments/stripe/*
// instead of /payments/*. Used for non-Georgian-locale checkout (see each
// checkout call site's `lang === 'ka' ? BOG : Stripe` branch).

export type StripeCurrency = 'usd' | 'eur';

export interface StripeCheckoutResult {
  paymentId: string;
  redirectUrl: string;
}

export interface StripeCourseCheckoutResult {
  paymentId: string;
  redirectUrl: string | null;
  enrolled?: boolean;
}

export interface StripeProductCheckoutResult {
  paymentId: string;
  // null when the admin test-mode bypass fired.
  redirectUrl: string | null;
  purchased?: boolean;
}

export interface StripePaymentStatusData {
  id: string;
  status: BogPaymentStatus;
  purpose: BogPaymentPurpose;
  referenceId: string;
  amount: number;
  currency: string;
  booking: BogPaymentBookingInfo | null;
}

export async function checkoutCourseStripe(
  courseId: string,
  promoCode?: string,
  currency: StripeCurrency = 'usd'
): Promise<StripeCourseCheckoutResult> {
  const response = await apiClient.post<StripeCourseCheckoutResult>(`/payments/stripe/checkout/course/${courseId}`, {
    promoCode,
    currency,
  });
  return response.data;
}

export async function checkoutMentorshipStripe(params: {
  mentorId: string;
  scheduledAt: string;
  studentPhone: string;
  consultationDescription?: string;
  currency?: StripeCurrency;
}): Promise<StripeCheckoutResult> {
  const response = await apiClient.post<StripeCheckoutResult>('/payments/stripe/checkout/mentorship', params);
  return response.data;
}

export async function checkoutGigEscrowStripe(gigId: string, currency: StripeCurrency = 'usd'): Promise<StripeCheckoutResult> {
  const response = await apiClient.post<StripeCheckoutResult>(`/payments/stripe/checkout/gig/${gigId}`, { currency });
  return response.data;
}

export async function checkoutProductStripe(productId: string, currency: StripeCurrency = 'usd'): Promise<StripeProductCheckoutResult> {
  const response = await apiClient.post<StripeProductCheckoutResult>(`/payments/stripe/checkout/product/${productId}`, { currency });
  return response.data;
}

// `enrolled` (not `purchased`) — same shape as StripeCourseCheckoutResult,
// since the admin test-mode free bypass grants enrollment directly rather
// than a product purchase.
export async function checkoutLiveTrainingStripe(id: string, currency: StripeCurrency = 'usd'): Promise<StripeCourseCheckoutResult> {
  const response = await apiClient.post<StripeCourseCheckoutResult>(`/payments/stripe/checkout/live-training/${id}`, { currency });
  return response.data;
}

export async function checkoutEnglishTutorSubscriptionStripe(currency: StripeCurrency = 'usd'): Promise<StripeCourseCheckoutResult> {
  const response = await apiClient.post<StripeCourseCheckoutResult>('/payments/stripe/checkout/english-tutor', { currency });
  return response.data;
}

export async function getStripePaymentStatus(paymentId: string): Promise<StripePaymentStatusData> {
  const response = await apiClient.get<{ data: StripePaymentStatusData }>(`/payments/stripe/status/${paymentId}`);
  return response.data.data;
}
