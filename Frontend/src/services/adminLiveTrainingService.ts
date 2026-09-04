import apiClient from './apiClient';
import { LiveTraining, LiveTrainingLead, LiveTrainingLeadStatus, LiveTrainingEnrollment } from '../types/liveTraining';
import { CourseLanguage } from '../types/lms';

export async function getAdminLiveTrainings(): Promise<LiveTraining[]> {
  const response = await apiClient.get<{ data: LiveTraining[] }>('/admin/live-trainings');
  return response.data.data;
}

export interface LiveTrainingPayload {
  title: string;
  description: string;
  category: string;
  scheduledAt: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  price?: number | null;
  thumbnailUrl?: string;
  videoUrl?: string;
  minCapacity?: number;
  maxCapacity: number;
  published?: boolean;
  language?: CourseLanguage;
  meetingUrl?: string;
  classroomUrl?: string;
  recordingUrl?: string;
  startDate?: string | null;
  endDate?: string | null;
  synopsisKa?: string | null;
  synopsisEn?: string | null;
  synopsisRu?: string | null;
}

export async function createLiveTraining(payload: LiveTrainingPayload): Promise<LiveTraining> {
  const response = await apiClient.post<{ data: LiveTraining }>('/admin/live-trainings', payload);
  return response.data.data;
}

export async function updateLiveTraining(id: string, payload: Partial<LiveTrainingPayload>): Promise<LiveTraining> {
  const response = await apiClient.put<{ data: LiveTraining }>(`/admin/live-trainings/${id}`, payload);
  return response.data.data;
}

export async function deleteLiveTraining(id: string): Promise<void> {
  await apiClient.delete(`/admin/live-trainings/${id}`);
}

export async function uploadLiveTrainingImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiClient.post<{ data: { url: string } }>('/admin/live-trainings/upload-image', formData);
  return response.data.data.url;
}

export async function getLiveTrainingLeads(trainingId: string): Promise<LiveTrainingLead[]> {
  const response = await apiClient.get<{ data: LiveTrainingLead[] }>(`/admin/live-trainings/${trainingId}/leads`);
  return response.data.data;
}

export async function updateLiveTrainingLead(
  leadId: string,
  payload: { status?: LiveTrainingLeadStatus; adminNote?: string | null }
): Promise<LiveTrainingLead> {
  const response = await apiClient.patch<{ data: LiveTrainingLead }>(`/admin/live-trainings/leads/${leadId}`, payload);
  return response.data.data;
}

// Same blob-download pattern as billingService.downloadSubscriptionInvoice —
// the caller creates an object URL and clicks a throwaway <a download>.
export async function exportLiveTrainingLeadsCsv(trainingId: string): Promise<Blob> {
  const response = await apiClient.get(`/admin/live-trainings/${trainingId}/leads/export`, { responseType: 'blob' });
  return response.data;
}

// The real, account-based cohort roster — distinct from the anonymous
// leads queue above.
export async function getLiveTrainingEnrollments(trainingId: string): Promise<LiveTrainingEnrollment[]> {
  const response = await apiClient.get<{ data: LiveTrainingEnrollment[] }>(`/admin/live-trainings/${trainingId}/enrollments`);
  return response.data.data;
}

// "✨ Regenerate AI Synopsis" — re-runs the recordingUrl -> audio -> Gemini
// pipeline on demand (Backend/src/services/liveTrainingSynopsisService.ts),
// independent of the auto-trigger that fires when recordingUrl itself
// changes. 202 — the pipeline runs fire-and-forget server-side; poll
// getAdminLiveTrainings()/re-fetch to see synopsisStatus flip to COMPLETED.
export async function regenerateLiveTrainingSynopsis(trainingId: string): Promise<void> {
  await apiClient.post(`/admin/live-trainings/${trainingId}/regenerate-synopsis`);
}

// Manual roster grant — admin override for bank-transfer/offline payments
// that never went through online checkout or the self-serve free enroll
// flow. Same shape/posture as adminFinanceService.ts's grantCourseAccess.
export interface GrantLiveTrainingEnrollmentPayload {
  userEmail?: string;
  userId?: string;
  note?: string;
}

export async function grantLiveTrainingEnrollment(
  trainingId: string,
  payload: GrantLiveTrainingEnrollmentPayload
): Promise<LiveTrainingEnrollment> {
  const response = await apiClient.post<{ data: LiveTrainingEnrollment }>(`/admin/live-trainings/${trainingId}/grant`, payload);
  return response.data.data;
}
