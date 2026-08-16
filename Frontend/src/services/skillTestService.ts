import apiClient from './apiClient';

export interface SkillClientMcqQuestion {
  id: string;
  type: 'mcq';
  question: string;
  options: { A: string; B: string; C: string; D: string };
}

export interface SkillClientPracticalQuestion {
  id: string;
  type: 'practical';
  question: string;
}

export type SkillClientQuestion = SkillClientMcqQuestion | SkillClientPracticalQuestion;

export interface GenerateSkillTestResult {
  attemptId: string;
  skillName: string;
  secondsPerQuestion: number;
  questions: SkillClientQuestion[];
}

export async function generateSkillTest(skillName: string, lang: 'ka' | 'en'): Promise<GenerateSkillTestResult> {
  const response = await apiClient.post<{ data: GenerateSkillTestResult }>('/skill-tests/generate', { skillName, lang });
  return response.data.data;
}

export interface SkillTestReviewItem {
  id: string;
  question: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  yourAnswer: 'A' | 'B' | 'C' | 'D' | null;
  explanation: string;
}

export interface SubmitSkillTestResult {
  mcqScore: number;
  practicalScore: number;
  totalScore: number;
  passed: boolean;
  correctCount: number;
  totalMcqQuestions: number;
  practicalFeedback: string | null;
  review: SkillTestReviewItem[];
}

export async function submitSkillTest(
  attemptId: string,
  payload: { mcqAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>; practicalAnswer?: string }
): Promise<SubmitSkillTestResult> {
  const response = await apiClient.post<{ data: SubmitSkillTestResult }>(`/skill-tests/${attemptId}/submit`, payload);
  return response.data.data;
}

export interface MySkillsResult {
  declaredSkills: string[];
  verifiedSkills: Array<{
    skillName: string;
    verifiedVia: 'AI_TEST' | 'COURSE_COMPLETION';
    score: number | null;
    verifiedAt: string;
  }>;
}

export async function getMySkills(): Promise<MySkillsResult> {
  const response = await apiClient.get<{ data: MySkillsResult }>('/skill-tests/mine');
  return response.data.data;
}
