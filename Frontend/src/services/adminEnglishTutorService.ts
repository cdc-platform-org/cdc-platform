import apiClient from './apiClient';
import { TutorTaskType, CefrLevel, TutorLearningGoal, TutorLessonContent } from './englishTutorService';

export interface TutorAnalytics {
  activeProSubscribers: number;
  totalUsers: number;
  everStartedTrial: number;
  conversionRate: number;
  revenueGel: number;
  totalPurchases: number;
  subscriptionPriceGel: number;
  averageScoreOverall: number | null;
  goalStats: { goal: TutorLearningGoal; totalTasks: number; completionRate: number; averageScore: number | null }[];
}

export async function getTutorAnalytics(): Promise<TutorAnalytics> {
  const response = await apiClient.get<{ data: TutorAnalytics }>('/admin/english-tutor/analytics');
  return response.data.data;
}

export interface AdminTutorLessonListItem {
  id: string;
  taskType: TutorTaskType;
  level: CefrLevel;
  nativeLang: string;
  topic: string | null;
  learningGoal: TutorLearningGoal | null;
  isPro: boolean;
  adminApproved: boolean;
  adminEdited: boolean;
  createdAt: string;
  generatedForUser: { id: string; name: string; email: string };
  _count: { flags: number };
}

export interface AdminTutorLesson extends Omit<AdminTutorLessonListItem, '_count'> {
  content: TutorLessonContent;
  flags: { id: string; reason: string; status: string; createdAt: string }[];
}

export async function listAdminTutorLessons(params: {
  taskType?: TutorTaskType;
  learningGoal?: TutorLearningGoal;
  adminApproved?: boolean;
  page?: number;
}): Promise<{ data: AdminTutorLessonListItem[]; meta: { total: number; page: number; pageSize: number } }> {
  const response = await apiClient.get('/admin/english-tutor/lessons', {
    params: { ...params, adminApproved: params.adminApproved === undefined ? undefined : String(params.adminApproved) },
  });
  return response.data;
}

export async function getAdminTutorLesson(id: string): Promise<AdminTutorLesson> {
  const response = await apiClient.get<{ data: AdminTutorLesson }>(`/admin/english-tutor/lessons/${id}`);
  return response.data.data;
}

export async function updateAdminTutorLesson(id: string, content: Record<string, unknown>): Promise<AdminTutorLesson> {
  const response = await apiClient.put<{ data: AdminTutorLesson }>(`/admin/english-tutor/lessons/${id}`, { content });
  return response.data.data;
}

export async function approveAdminTutorLesson(id: string): Promise<AdminTutorLesson> {
  const response = await apiClient.post<{ data: AdminTutorLesson }>(`/admin/english-tutor/lessons/${id}/approve`);
  return response.data.data;
}

export async function regenerateAdminTutorLesson(id: string): Promise<AdminTutorLesson> {
  const response = await apiClient.post<{ data: AdminTutorLesson }>(`/admin/english-tutor/lessons/${id}/regenerate`);
  return response.data.data;
}

export interface AdminTutorProgressItem {
  id: string;
  userId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  score: number | null;
  responseData: unknown;
  feedback: { summary: string; strengths?: string[]; corrections?: string[]; perQuestion?: { correct: boolean; explanation: string }[] } | null;
  startedAt: string;
  completedAt: string | null;
  user: { id: string; name: string; email: string };
  tutorLesson: { id: string; taskType: TutorTaskType; level: CefrLevel; topic: string | null; learningGoal: TutorLearningGoal | null };
  flags: { id: string; reason: string; createdAt: string }[];
}

export async function listAdminTutorAuditLogs(params: {
  userId?: string;
  taskType?: TutorTaskType;
  flagged?: boolean;
  page?: number;
}): Promise<{ data: AdminTutorProgressItem[]; meta: { total: number; page: number; pageSize: number } }> {
  const response = await apiClient.get('/admin/english-tutor/audit-logs', {
    params: { ...params, flagged: params.flagged ? 'true' : undefined },
  });
  return response.data;
}

export interface AdminTutorFlag {
  id: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  adminNote: string | null;
  createdAt: string;
  flaggedByUser: { id: string; name: string; email: string };
  tutorLesson: { id: string; taskType: TutorTaskType; level: CefrLevel } | null;
  userTutorProgress: { id: string; tutorLessonId: string } | null;
}

export async function listAdminTutorFlags(status: 'OPEN' | 'RESOLVED' | 'DISMISSED' = 'OPEN'): Promise<AdminTutorFlag[]> {
  const response = await apiClient.get<{ data: AdminTutorFlag[] }>('/admin/english-tutor/flags', { params: { status } });
  return response.data.data;
}

export async function resolveAdminTutorFlag(id: string, status: 'RESOLVED' | 'DISMISSED', adminNote?: string): Promise<AdminTutorFlag> {
  const response = await apiClient.post<{ data: AdminTutorFlag }>(`/admin/english-tutor/flags/${id}/resolve`, { status, adminNote });
  return response.data.data;
}

export interface AdminTutorPromptConfig {
  taskType: TutorTaskType;
  systemPromptOverride: string | null;
  temperatureOverride: number | null;
  updatedAt: string | null;
}

export async function getAdminTutorPromptConfig(): Promise<AdminTutorPromptConfig[]> {
  const response = await apiClient.get<{ data: AdminTutorPromptConfig[] }>('/admin/english-tutor/prompt-config');
  return response.data.data;
}

export async function updateAdminTutorPromptConfig(
  taskType: TutorTaskType,
  params: { systemPromptOverride: string | null; temperatureOverride: number | null }
): Promise<AdminTutorPromptConfig> {
  const response = await apiClient.put<{ data: AdminTutorPromptConfig }>(`/admin/english-tutor/prompt-config/${taskType}`, params);
  return response.data.data;
}
