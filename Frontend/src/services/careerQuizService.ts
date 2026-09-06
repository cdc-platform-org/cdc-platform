import apiClient from './apiClient';
import { CareerQuizSubmission, CareerQuizAudience, CareerQuizGender } from '../types/careerQuiz';

export interface CareerQuizSubmitPayload {
  fullName: string;
  email: string;
  phone: string;
  audience: CareerQuizAudience;
  gender: CareerQuizGender;
  age: number;
  answers: Record<string, string>;
  ref?: string | null;
  lang: 'ka' | 'en';
}

// Throws an axios error with response.status === 429 and
// response.data.code === 'DAILY_LIMIT_REACHED' once the caller has already
// submitted DAILY_QUIZ_LIMIT (3) times today — see Backend's
// careerQuizService.ts.
export async function submitCareerQuiz(payload: CareerQuizSubmitPayload): Promise<CareerQuizSubmission> {
  const response = await apiClient.post<{ data: CareerQuizSubmission }>('/career-quiz/submit', payload);
  return response.data.data;
}

export async function getMyCareerQuizSubmissions(): Promise<CareerQuizSubmission[]> {
  const response = await apiClient.get<{ data: CareerQuizSubmission[] }>('/career-quiz/mine');
  return response.data.data;
}
