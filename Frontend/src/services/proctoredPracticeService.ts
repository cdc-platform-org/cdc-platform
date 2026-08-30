import apiClient from './apiClient';

// ============================================================
// AI Proctored Practice Exam — Frontend API client for
// Backend's routes/proctoredPractice.ts.
// ============================================================

export type ExamLevel = 'JUNIOR' | 'MID' | 'SENIOR' | 'EXPERT';

export interface McqQuestion {
  type: 'MCQ';
  order: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}

export interface OpenQuestion {
  type: 'PRACTICAL' | 'CODE';
  order: number;
  question: string;
  // AI grading rubric — never displayed to the candidate while taking the
  // exam, only sent back to the server at grading time.
  rubric: string;
}

export type ExamQuestion = McqQuestion | OpenQuestion;

export interface GenerateExamPayload {
  subject: string;
  level: ExamLevel;
  questionCount: number;
  language: 'ka' | 'en';
}

export async function generatePracticeExam(payload: GenerateExamPayload): Promise<{ topic: string; questions: ExamQuestion[] }> {
  const response = await apiClient.post<{ data: { topic: string; questions: ExamQuestion[] } }>('/proctored-practice/generate', payload, {
    timeout: 90 * 1000,
  });
  return response.data.data;
}

export interface GradePracticalPayload {
  topic: string;
  questionType: 'PRACTICAL' | 'CODE';
  question: string;
  rubric: string;
  answer: string;
}

export async function gradePracticalAnswer(payload: GradePracticalPayload): Promise<{ score: number; feedback: string }> {
  const response = await apiClient.post<{ data: { score: number; feedback: string } }>('/proctored-practice/grade-practical', payload, {
    timeout: 60 * 1000,
  });
  return response.data.data;
}
