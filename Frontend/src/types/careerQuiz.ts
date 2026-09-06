export type CareerQuizAudience = 'SELF' | 'CHILD';

export interface CareerQuizSubmission {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  audience: CareerQuizAudience;
  interests: string;
  experience: string;
  mainGoal: string;
  resultText: string;
  age: number | null;
  ref: string | null;
  createdAt: string;
}
