import apiClient from './apiClient';

// ============================================================
// IAKO Trainer Tools — Frontend service for the authenticated
// Trainer workspace (Backend routes/trainerWorkspace.ts).
// Every endpoint is server-authorization-scoped; nothing here
// is a broad admin surface.
// ============================================================

export interface TrainerMe {
  isTrainer: boolean;
  id?: string;
  createdAt?: string;
}

export interface MyAssignedLiveTraining {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  category: string;
  scheduledAt: string;
  published: boolean;
  thumbnailUrl: string | null;
  meetingUrl: string | null;
  classroomUrl: string | null;
  recordingUrl: string | null;
  trainerVideoUrl: string | null;
  maxCapacity: number;
  startDate: string | null;
  endDate: string | null;
  participantCount: number;
  assignedAt: string;
}

export interface TrainerParticipantEnrollment {
  id: string;
  status: string;
  enrolledAt: string;
  user: { id: string; name: string; email: string };
}

// Same wire shape as the learner guide (see trainingGuideService.ts), plus
// per-day completion metrics for the trainer's elevated/admin-equivalent view.
export interface TrainerGuide {
  training: { id: string; title: string };
  settings: {
    timeZone: string;
    paused: boolean;
    startDate: string | null;
    visibility: string;
    currentDayOverride: number | null;
  };
  currentDayNumber: number | null;
  days: Array<{
    id: string;
    dayNumber: number;
    title: string;
    summary: string;
    published: boolean;
    scheduledDate: string | null;
    sourcePages: number[];
    sections: Array<{
      id: string;
      kind: string;
      title: string;
      items: Array<{ id: string; title: string; body: string; language?: string; url?: string }>;
    }>;
  }>;
  metrics: Array<{ dayId: string; dayNumber: number; totalParticipants: number; completedParticipants: number }>;
}

// Trainer-side update payload — intentionally narrower than the admin
// TrainingDayInput (Backend rejects renumbering/moving a day outright).
export interface TrainerGuideDayInput {
  dayNumber: number;
  title: string;
  summary: string;
  published: boolean;
  scheduledDate: string | null;
  sourcePages: number[];
  sections: TrainerGuide['days'][number]['sections'];
}

export async function getTrainerMe(): Promise<TrainerMe> {
  const response = await apiClient.get<{ data: TrainerMe }>('/trainer/me', { silent401: true });
  return response.data.data;
}

export async function getMyAssignedTrainings(): Promise<MyAssignedLiveTraining[]> {
  const response = await apiClient.get<{ data: MyAssignedLiveTraining[] }>('/trainer/live-trainings');
  return response.data.data;
}

export async function getAssignedTraining(id: string): Promise<MyAssignedLiveTraining> {
  const response = await apiClient.get<{ data: MyAssignedLiveTraining }>(`/trainer/live-trainings/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function getAssignedTrainingParticipants(id: string): Promise<TrainerParticipantEnrollment[]> {
  const response = await apiClient.get<{ data: TrainerParticipantEnrollment[] }>(
    `/trainer/live-trainings/${encodeURIComponent(id)}/participants`
  );
  return response.data.data;
}

export async function getAssignedTrainingGuide(id: string): Promise<TrainerGuide> {
  const response = await apiClient.get<{ data: TrainerGuide }>(`/trainer/live-trainings/${encodeURIComponent(id)}/guides`);
  return response.data.data;
}

export async function updateAssignedTrainingGuideDay(
  trainingId: string,
  dayId: string,
  day: TrainerGuideDayInput
): Promise<void> {
  await apiClient.put(
    `/trainer/live-trainings/${encodeURIComponent(trainingId)}/guides/days/${encodeURIComponent(dayId)}`,
    day
  );
}

// Reuses the same public/trainer video upload middleware as the
// DigitalProduct previewVideoUrl flow (Backend productUploads.ts) — a single
// `video` form field with the same size/type limits.
export async function uploadTrainerVideo(trainingId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('video', file);
  const response = await apiClient.post<{ data: { trainerVideoUrl: string | null } }>(
    `/trainer/live-trainings/${encodeURIComponent(trainingId)}/trainer-video`,
    form
  );
  return response.data.data.trainerVideoUrl ?? '';
}

export async function deleteTrainerVideo(trainingId: string): Promise<void> {
  await apiClient.delete(`/trainer/live-trainings/${encodeURIComponent(trainingId)}/trainer-video`);
}
