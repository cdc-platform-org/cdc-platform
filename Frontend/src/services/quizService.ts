import apiClient from './apiClient';

// ============================================================
// Public, no-login student quiz — Frontend API client for Backend's
// routes/teacherQuiz.ts (mounted at /api/quiz). Used only by
// pages/quiz/[shareToken].tsx; never requires authentication.
// ============================================================

export type PublicQuizQuestionType = 'MULTIPLE_CHOICE' | 'FREE_TEXT';

export interface PublicQuizQuestion {
  id: string;
  type: PublicQuizQuestionType;
  question: string;
  options: Record<string, string> | null;
}

export interface PublicQuiz {
  title: string;
  language: 'ka' | 'en';
  questions: PublicQuizQuestion[];
}

export async function getPublicQuiz(shareToken: string): Promise<PublicQuiz> {
  const response = await apiClient.get<{ data: PublicQuiz }>(`/quiz/${shareToken}`);
  return response.data.data;
}

export interface QuizAnswerResult {
  questionId: string;
  correct: boolean;
  feedback?: string;
}

export interface QuizSubmitResult {
  submissionId: string;
  score: number;
  correctCount: number;
  total: number;
  results: QuizAnswerResult[];
}

export async function submitPublicQuiz(shareToken: string, studentName: string, answers: Record<string, string>): Promise<QuizSubmitResult> {
  const response = await apiClient.post<{ data: QuizSubmitResult }>(`/quiz/${shareToken}/submit`, { studentName, answers }, { timeout: 60 * 1000 });
  return response.data.data;
}
