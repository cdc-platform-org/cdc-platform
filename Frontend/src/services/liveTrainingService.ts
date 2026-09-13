import apiClient from './apiClient';
import { LiveTraining, MyLiveTrainingEnrollment } from '../types/liveTraining';

// A null redirect with enrolled=true is reserved for a server-verified
// legitimate zero-price checkout, including a valid 100% promo discount.
export interface LiveTrainingCheckoutResult {
  paymentId: string;
  redirectUrl: string | null;
  enrolled?: boolean;
}

// Authenticated self-serve checkout for a PRICED training — see Backend's
// routes/payments.ts's /checkout/live-training route comment for why this
// exists (POST .../enroll below is free-trainings-only now).
export async function checkoutLiveTraining(id: string, promoCode?: string, lang?: 'ka' | 'en'): Promise<LiveTrainingCheckoutResult> {
  const response = await apiClient.post<LiveTrainingCheckoutResult>(`/payments/checkout/live-training/${id}`, { promoCode, lang });
  return response.data;
}

export async function getLiveTrainings(category?: string): Promise<LiveTraining[]> {
  const response = await apiClient.get<{ data: LiveTraining[] }>('/live-trainings', {
    params: category ? { category } : undefined,
  });
  return response.data.data;
}

export async function getLiveTraining(id: string): Promise<LiveTraining> {
  const response = await apiClient.get<{ data: LiveTraining }>(`/live-trainings/${id}`);
  return response.data.data;
}

export interface LiveTrainingRegisterPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  website?: string;
  // The site's currently-active locale (resolveLocale(router.locale)) at
  // submit time — the backend uses this to pick the registration
  // confirmation email/WhatsApp language (Georgian for anything but 'en').
  locale?: string;
}

export async function registerForLiveTraining(id: string, payload: LiveTrainingRegisterPayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ data: { id: string } }>(`/live-trainings/${id}/register`, payload);
  return response.data.data;
}

// Authenticated self-serve alternative to the anonymous lead form above —
// see LiveTrainingEnrollment's own schema comment for why both exist.
// `locale` picks the enrollment confirmation email/WhatsApp language, same
// convention as registerForLiveTraining above.
export async function enrollInLiveTraining(id: string, locale?: string): Promise<void> {
  await apiClient.post(`/live-trainings/${id}/enroll`, { locale });
}

export async function cancelLiveTrainingEnrollment(id: string): Promise<void> {
  await apiClient.delete(`/live-trainings/${id}/enroll`);
}

export async function getMyLiveTrainingEnrollments(): Promise<MyLiveTrainingEnrollment[]> {
  const response = await apiClient.get<{ data: MyLiveTrainingEnrollment[] }>('/live-trainings/mine');
  return response.data.data;
}
