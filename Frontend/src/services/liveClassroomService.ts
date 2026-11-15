/**
 * @fileoverview Typed frontend API client for Live Classroom multi-screen sharing,
 * session recording storage, and automated student email notifications.
 */

import api from './api';

export interface StudentScreenFrame {
  userId: string;
  studentName: string;
  studentEmail: string;
  imageDataUrl: string;
  activeTool?: string;
  updatedAt: number;
}

export interface ClassroomRecordingRecord {
  id: string;
  trainingId: string;
  title: string;
  recordingUrl: string;
  recordedBy: string;
  createdAt: string;
  emailedToCount: number;
}

export async function pushStudentScreenFrame(
  trainingId: string,
  payload: { imageDataUrl: string; studentName?: string; activeTool?: string }
): Promise<void> {
  await api.post(`/live-classroom/${encodeURIComponent(trainingId)}/screen-frame`, payload);
}

export async function stopStudentScreenShare(trainingId: string): Promise<void> {
  await api.delete(`/live-classroom/${encodeURIComponent(trainingId)}/screen-frame`);
}

export async function fetchClassroomState(trainingId: string): Promise<{
  screens: StudentScreenFrame[];
  recordings: ClassroomRecordingRecord[];
}> {
  const res = await api.get(`/live-classroom/${encodeURIComponent(trainingId)}/screens`);
  return res.data;
}

export async function saveRecordingAndNotifyStudents(
  trainingId: string,
  recordingUrl: string
): Promise<ClassroomRecordingRecord> {
  const res = await api.post(`/live-classroom/${encodeURIComponent(trainingId)}/recording-complete`, {
    recordingUrl,
  });
  return res.data.record;
}