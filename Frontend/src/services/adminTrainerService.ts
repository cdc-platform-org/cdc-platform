import apiClient from './apiClient';

// ============================================================
// IAKO Trainer Tools — Frontend service for the SUPER_ADMIN/MANAGER
// trainer roster + per-training trainer assignments
// (Backend adminTrainers.ts / adminLiveTrainingTrainers.ts).
// Deliberately separate from adminPanelService.ts's marketing TeamMember
// (team-trainers.tsx) — that's a public-bio CMS, not a capability toggle.
// ============================================================

export interface AdminTrainerProfile {
  id: string;
  userId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  _count: { assignments: number };
}

export interface AdminTrainerAssignment {
  id: string;
  trainerProfileId: string;
  liveTrainingId: string;
  createdAt: string;
  trainerProfile: Omit<AdminTrainerProfile, '_count'>;
}

export async function getAdminTrainers(): Promise<AdminTrainerProfile[]> {
  const response = await apiClient.get<{ data: AdminTrainerProfile[] }>('/admin/trainers');
  return response.data.data;
}

export async function createTrainerProfile(userId: string): Promise<AdminTrainerProfile> {
  const response = await apiClient.post<{ data: AdminTrainerProfile }>('/admin/trainers', { userId });
  return response.data.data;
}

export async function setTrainerProfileActive(id: string, active: boolean): Promise<AdminTrainerProfile> {
  const response = await apiClient.patch<{ data: AdminTrainerProfile }>(`/admin/trainers/${encodeURIComponent(id)}`, { active });
  return response.data.data;
}

export async function getTrainingTrainerAssignments(trainingId: string): Promise<AdminTrainerAssignment[]> {
  const response = await apiClient.get<{ data: AdminTrainerAssignment[] }>(
    `/admin/live-trainings/${encodeURIComponent(trainingId)}/trainers`
  );
  return response.data.data;
}

export async function assignTrainerToTraining(trainingId: string, trainerProfileId: string): Promise<AdminTrainerAssignment> {
  const response = await apiClient.post<{ data: AdminTrainerAssignment }>(
    `/admin/live-trainings/${encodeURIComponent(trainingId)}/trainers`,
    { trainerProfileId }
  );
  return response.data.data;
}

export async function removeTrainerAssignment(trainingId: string, assignmentId: string): Promise<void> {
  await apiClient.delete(
    `/admin/live-trainings/${encodeURIComponent(trainingId)}/trainers/${encodeURIComponent(assignmentId)}`
  );
}
