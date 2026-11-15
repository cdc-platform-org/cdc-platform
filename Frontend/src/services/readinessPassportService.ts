/**
 * @fileoverview Typed frontend API client for Pre-Exam Readiness Dossiers
 * and Student Digital Skill Passports.
 */

import api from './api';

export interface ReadinessRecord {
  id: string;
  userId: string;
  courseId: string;
  aiMentorScore: number;
  attendanceScore: number;
  assignmentsScore: number;
  lecturerScore: number;
  totalScore: number;
  aiCritique?: string | null;
  lecturerNote?: string | null;
  lecturerName?: string | null;
  evaluatedAt: string;
}

export interface ReadinessResponse {
  record: ReadinessRecord;
  eligibleForExam: boolean;
  threshold: number;
  courseTitle?: string;
  aiCritique?: string;
}

export async function getCourseReadiness(courseId: string): Promise<ReadinessResponse> {
  const res = await api.get(`/readiness/${encodeURIComponent(courseId)}`);
  return res.data;
}

export async function evaluateWorkWithAi(
  courseId: string,
  payload: { lessonTitle?: string; assignmentPrompt?: string; submissionNote?: string; hasFile?: boolean }
): Promise<ReadinessResponse> {
  const res = await api.post(`/readiness/${encodeURIComponent(courseId)}/ai-evaluate`, payload);
  return res.data;
}

export async function pingAttendanceCheckpoint(
  courseId: string,
  checkpointPassed: boolean
): Promise<ReadinessResponse> {
  const res = await api.post(`/readiness/${encodeURIComponent(courseId)}/attendance-ping`, {
    checkpointPassed,
  });
  return res.data;
}