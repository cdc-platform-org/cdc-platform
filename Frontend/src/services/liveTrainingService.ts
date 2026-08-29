import apiClient from './apiClient';
import { LiveTraining, MyLiveTrainingEnrollment } from '../types/liveTraining';

// Priced-training checkout result — same null-redirectUrl-means-already-
// granted shape as paymentService.ts's CourseCheckoutResult (the admin
// test-mode free bypass in Backend's /checkout/live-training route).
export interface LiveTrainingCheckoutResult {
  paymentId: string;
  redirectUrl: string | null;
  enrolled?: boolean;
}

// Authenticated self-serve checkout for a PRICED training — see Backend's
// routes/payments.ts's /checkout/live-training route comment for why this
// exists (POST .../enroll below is free-trainings-only now).
export async function checkoutLiveTraining(id: string, lang?: 'ka' | 'en'): Promise<LiveTrainingCheckoutResult> {
  const response = await apiClient.post<LiveTrainingCheckoutResult>(`/payments/checkout/live-training/${id}`, { lang });
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
  name: string;
  email: string;
  phone: string;
}

export async function registerForLiveTraining(id: string, payload: LiveTrainingRegisterPayload): Promise<{ id: string }> {
  const response = await apiClient.post<{ data: { id: string } }>(`/live-trainings/${id}/register`, payload);
  return response.data.data;
}

// Authenticated self-serve alternative to the anonymous lead form above —
// see LiveTrainingEnrollment's own schema comment for why both exist.
export async function enrollInLiveTraining(id: string): Promise<void> {
  await apiClient.post(`/live-trainings/${id}/enroll`);
}

export async function cancelLiveTrainingEnrollment(id: string): Promise<void> {
  await apiClient.delete(`/live-trainings/${id}/enroll`);
}

export async function getMyLiveTrainingEnrollments(): Promise<MyLiveTrainingEnrollment[]> {
  const response = await apiClient.get<{ data: MyLiveTrainingEnrollment[] }>('/live-trainings/mine');
  return response.data.data;
}
