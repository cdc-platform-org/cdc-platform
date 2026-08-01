import apiClient from './apiClient';
import { JobCategory } from '../types/community';

export interface ExamQuestion {
  id: string;
  topic: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
}

export interface ExamAttemptResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  review: {
    id: string;
    question: string;
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    yourAnswer: 'A' | 'B' | 'C' | 'D' | null;
    explanation: string;
  }[];
}

export async function generateExam(category: JobCategory): Promise<{ attemptId: string; category: JobCategory; questions: ExamQuestion[] }> {
  const response = await apiClient.post<{ data: { attemptId: string; category: JobCategory; questions: ExamQuestion[] } }>(
    '/freelancer-exam/generate',
    { category }
  );
  return response.data.data;
}

export async function submitExam(attemptId: string, answers: Record<string, 'A' | 'B' | 'C' | 'D'>): Promise<ExamAttemptResult> {
  const response = await apiClient.post<{ data: ExamAttemptResult }>(`/freelancer-exam/${attemptId}/submit`, { answers });
  return response.data.data;
}
