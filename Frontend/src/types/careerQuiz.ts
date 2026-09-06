export type CareerQuizAudience = 'SELF' | 'CHILD';
export type CareerQuizGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface CareerQuizSubmission {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  audience: CareerQuizAudience;
  gender: CareerQuizGender;
  age: number;
  answers: Record<string, string>;
  resultText: string;
  ref: string | null;
  createdAt: string;
}
