import apiClient from './apiClient';

// ============================================================
// AI Educator VIP Hub — Frontend API client for Backend's routes/educatorHub.ts.
// ============================================================

export interface EducatorUsage {
  generationsUsed: number;
  generationsLimit: number;
  gradingsUsed: number;
  gradingsLimit: number;
}

export interface EducatorHubState {
  hasAccess: boolean;
  isVipActive: boolean;
  trialAvailable: boolean;
  trialActive: boolean;
  educatorVipTrialEndDate: string | null;
  usage: EducatorUsage | null;
}

export async function getEducatorHubState(): Promise<EducatorHubState> {
  const response = await apiClient.get<{ data: EducatorHubState }>('/educator-hub/state');
  return response.data.data;
}

export async function startEducatorVipTrial(): Promise<{ educatorVipTrialEndDate: string; trialDays: number }> {
  const response = await apiClient.post<{ data: { educatorVipTrialEndDate: string; trialDays: number } }>('/educator-hub/trial/start');
  return response.data.data;
}

export type QuestionType = 'MULTIPLE_CHOICE' | 'OPEN' | 'MATCHING';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';

export interface GenerateTestPayload {
  subject: string;
  grade: string;
  topic: string;
  questionTypes: QuestionType[];
  difficulty: Difficulty;
  questionCount: number;
  language: 'ka' | 'en';
}

export interface GeneratedTest {
  testSheet: string;
  answerKey: string;
}

export async function generateTest(payload: GenerateTestPayload): Promise<GeneratedTest> {
  const response = await apiClient.post<{ data: GeneratedTest }>('/educator-hub/generate-test', payload, { timeout: 90 * 1000 });
  return response.data.data;
}

export interface GenerateRubricPayload {
  subject: string;
  grade: string;
  assessmentType: 'FORMATIVE' | 'SUMMATIVE' | 'DIAGNOSTIC' | 'PROJECT';
  skillOrTopic: string;
  scoringScale: string;
  language: 'ka' | 'en';
}

export interface GeneratedRubric {
  rubric: string;
}

export async function generateRubric(payload: GenerateRubricPayload): Promise<GeneratedRubric> {
  const response = await apiClient.post<{ data: GeneratedRubric }>('/educator-hub/generate-rubric', payload, { timeout: 90 * 1000 });
  return response.data.data;
}

export interface GradeHomeworkPayload {
  assignmentPrompt: string;
  studentWorkText?: string;
  studentWorkImage?: File;
  gradingScale: string;
  language: 'ka' | 'en';
}

export interface GradedHomework {
  score: string;
  errorAnalysis: string;
  feedback: string;
}

export async function gradeHomework(payload: GradeHomeworkPayload): Promise<GradedHomework> {
  const formData = new FormData();
  formData.append('assignmentPrompt', payload.assignmentPrompt);
  formData.append('gradingScale', payload.gradingScale);
  formData.append('language', payload.language);
  if (payload.studentWorkText) formData.append('studentWorkText', payload.studentWorkText);
  if (payload.studentWorkImage) formData.append('studentWork', payload.studentWorkImage);
  const response = await apiClient.post<{ data: GradedHomework }>('/educator-hub/grade-homework', formData, { timeout: 90 * 1000 });
  return response.data.data;
}
