import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';

export function isAiExamConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export interface GeneratedQuestion {
  id: string;
  topic: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

// What the model must return — validated with zod rather than trusted
// blindly, since this is scored server-side and a malformed question would
// otherwise corrupt an ExamAttempt.
const questionSchema = z.object({
  topic: z.string().min(1),
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(1),
});
const questionsResponseSchema = z.object({ questions: z.array(questionSchema) });

export interface GenerateExamParams {
  courseTitle: string;
  courseDescription: string;
  lessonTitles: string[];
  questionCount: number;
  aiPromptContext?: string | null;
  // Set on a retake after a failed attempt — steers the new question set
  // toward the topics the student got wrong last time.
  focusTopics?: string[];
}

export class AiExamGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiExamGenerationError';
  }
}

export async function generateExamQuestions(params: GenerateExamParams): Promise<GeneratedQuestion[]> {
  if (!client) {
    throw new AiExamGenerationError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  const focusLine = params.focusTopics?.length
    ? `\nThe student failed a previous attempt with weak understanding of: ${params.focusTopics.join(', ')}. Weight the new questions toward these topics.`
    : '';
  const contextLine = params.aiPromptContext ? `\nAdditional instructions from the course admin: ${params.aiPromptContext}` : '';

  const prompt = `You are generating a certification exam for the online course "${params.courseTitle}".
Course description: ${params.courseDescription}
Lesson topics covered: ${params.lessonTitles.join(', ') || '(no lessons listed)'}${focusLine}${contextLine}

Generate exactly ${params.questionCount} multiple-choice questions that test real understanding of the course material (not trivia). Each question must have exactly 4 options (A, B, C, D), one correct answer, and a short explanation of why it's correct. Vary the topics across the course's lessons. Respond with strict JSON matching this shape:
{"questions": [{"topic": string, "question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]}`;

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
  });

  let raw: string;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new AiExamGenerationError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
  }
  if (!raw) throw new AiExamGenerationError('Gemini returned an empty response.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiExamGenerationError('Gemini returned malformed JSON.');
  }

  const result = questionsResponseSchema.safeParse(parsed);
  if (!result.success || result.data.questions.length === 0) {
    throw new AiExamGenerationError('Gemini returned an unexpected question format.');
  }

  return result.data.questions.slice(0, params.questionCount).map((q, i) => ({ id: `q${i + 1}`, ...q }));
}
