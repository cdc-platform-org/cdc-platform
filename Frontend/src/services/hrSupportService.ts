import apiClient from './apiClient';
import { HRSupportQuote, HRSupportRequest } from '../types/hrSupport';

export async function getHRSupportQuote(vacancyId: string): Promise<HRSupportQuote> {
  const response = await apiClient.get<HRSupportQuote>(`/hr-support/quote/${vacancyId}`);
  return response.data;
}

export async function getMyHRSupportRequests(): Promise<HRSupportRequest[]> {
  const response = await apiClient.get<HRSupportRequest[]>('/hr-support/mine');
  return response.data;
}

export async function getHRSupportRequest(id: string): Promise<HRSupportRequest> {
  const response = await apiClient.get<HRSupportRequest>(`/hr-support/${id}`);
  return response.data;
}

export async function confirmHRSupportRequest(id: string): Promise<HRSupportRequest> {
  const response = await apiClient.post<HRSupportRequest>(`/hr-support/${id}/confirm`);
  return response.data;
}

export async function disputeHRSupportRequest(id: string, reason: string): Promise<HRSupportRequest> {
  const response = await apiClient.post<HRSupportRequest>(`/hr-support/${id}/dispute`, { reason });
  return response.data;
}

// ---- Specialist-facing (isHrSpecialist accounts, or an admin) ----

export async function getHRRequestsAssignedToMe(): Promise<HRSupportRequest[]> {
  const response = await apiClient.get<HRSupportRequest[]>('/hr-support/assigned-to-me');
  return response.data;
}

export interface UpdateCandidateEvaluationPayload {
  hardSkillsScore?: number | null;
  softSkillsScore?: number | null;
  taskScore?: number | null;
  culturalFitScore?: number | null;
  overallRank?: number | null;
  hrNotes?: string | null;
  meetingUrl?: string | null;
  interviewAt?: string | null;
  status?: 'PENDING' | 'TASK_SENT' | 'TASK_SUBMITTED' | 'INTERVIEWED' | 'SCORED';
}

export async function updateCandidateEvaluation(
  requestId: string,
  evaluationId: string,
  payload: UpdateCandidateEvaluationPayload
) {
  const response = await apiClient.put(`/hr-support/${requestId}/candidates/${evaluationId}`, payload);
  return response.data;
}

export async function deliverHRSupportRequest(requestId: string, reportSummary: string): Promise<HRSupportRequest> {
  const response = await apiClient.post<HRSupportRequest>(`/hr-support/${requestId}/deliver`, { reportSummary });
  return response.data;
}
