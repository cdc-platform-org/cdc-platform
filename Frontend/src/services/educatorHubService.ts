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
  sourceText?: string;
  sourceFile?: File;
}

export type StructuredQuestionType = 'MULTIPLE_CHOICE' | 'FREE_TEXT';

export interface StructuredTestQuestion {
  question: string;
  type: StructuredQuestionType;
  options?: Record<string, string>;
  correctAnswer: string;
}

export interface GeneratedTest {
  testSheet: string;
  answerKey: string;
  questions: StructuredTestQuestion[];
}

export async function generateTest(payload: GenerateTestPayload): Promise<GeneratedTest> {
  const formData = new FormData();
  formData.append('subject', payload.subject);
  formData.append('grade', payload.grade);
  formData.append('topic', payload.topic);
  formData.append('questionTypes', JSON.stringify(payload.questionTypes));
  formData.append('difficulty', payload.difficulty);
  formData.append('questionCount', String(payload.questionCount));
  formData.append('language', payload.language);
  if (payload.sourceText) formData.append('sourceText', payload.sourceText);
  if (payload.sourceFile) formData.append('sourceFile', payload.sourceFile);
  const response = await apiClient.post<{ data: GeneratedTest }>('/educator-hub/generate-test', formData, { timeout: 90 * 1000 });
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

export interface GenerateDifferentiatedTaskPayload {
  subject: string;
  grade: string;
  topic: string;
  senAdaptations: boolean;
  language: 'ka' | 'en';
}

export interface GeneratedDifferentiatedTask {
  basicLevel: string;
  standardLevel: string;
  advancedLevel: string;
  senAdaptations?: string;
}

export async function generateDifferentiatedTask(payload: GenerateDifferentiatedTaskPayload): Promise<GeneratedDifferentiatedTask> {
  const response = await apiClient.post<{ data: GeneratedDifferentiatedTask }>('/educator-hub/generate-differentiated-task', payload, { timeout: 90 * 1000 });
  return response.data.data;
}

export type LessonType = 'STANDARD' | 'STEM' | 'PROJECT_BASED';

export interface GenerateLessonPlanPayload {
  subject: string;
  grade: string;
  topic: string;
  durationMinutes: number;
  lessonType: LessonType;
  language: 'ka' | 'en';
}

export interface GeneratedLessonPlan {
  lessonPlan: string;
}

export async function generateLessonPlan(payload: GenerateLessonPlanPayload): Promise<GeneratedLessonPlan> {
  const response = await apiClient.post<{ data: GeneratedLessonPlan }>('/educator-hub/generate-lesson-plan', payload, { timeout: 90 * 1000 });
  return response.data.data;
}

// ---- Sharing a generated test as a no-login student quiz ----

export interface CreateQuizPayload {
  title: string;
  language: 'ka' | 'en';
  questions: StructuredTestQuestion[];
}

export async function createQuiz(payload: CreateQuizPayload): Promise<{ id: string; shareToken: string }> {
  const response = await apiClient.post<{ data: { id: string; shareToken: string } }>('/educator-hub/quizzes', payload);
  return response.data.data;
}

export interface QuizSubmissionSummary {
  id: string;
  studentName: string;
  score: number;
  submittedAt: string;
}

export async function getQuizSubmissions(quizId: string): Promise<QuizSubmissionSummary[]> {
  const response = await apiClient.get<{ data: QuizSubmissionSummary[] }>(`/educator-hub/quizzes/${quizId}/submissions`);
  return response.data.data;
}
