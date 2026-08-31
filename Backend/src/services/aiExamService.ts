import { z } from 'zod';
import { callTextModel, AiAgentError } from './aiAgentService';
import { isAzureOpenAiConfigured } from './azureOpenAiService';
import { GEMINI_API_KEY } from '../utils/env';

const DIFFICULTY_LEVEL = 'BEGINNER_A1'; // Set difficulty level to Beginner A1
}

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
  // UI locale to write the generated text in — omit to default to English
  // (existing course-certification exam behavior, unchanged).
  lang?: 'ka' | 'en';
}

export class AiExamGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiExamGenerationError';
  }
}

export async function generateExamQuestions(params: GenerateExamParams): Promise<GeneratedQuestion[]> {
  if (!isAiExamConfigured()) {
    throw new AiExamGenerationError('AI exam generation is not configured (GEMINI_API_KEY/AZURE_OPENAI_* missing).');
  }

  const focusLine = params.focusTopics?.length
    ? `\nThe student failed a previous attempt with weak understanding of: ${params.focusTopics.join(', ')}. Weight the new questions toward these topics.`
    : '';
  const contextLine = params.aiPromptContext ? `\nAdditional instructions from the course admin: ${params.aiPromptContext}` : '';
  const languageLine =
    params.lang === 'ka'
      ? '\nWrite the "topic", "question", "options", and "explanation" fields in Georgian (ქართული). Keep standard IT/design terminology that is normally used in English even in Georgian technical speech in English (e.g. "Checkout flow", "Wireframe", "API", "SEO").'
      : '\nWrite the "topic", "question", "options", and "explanation" fields entirely in English.';

  const prompt = `You are evaluating a student's response for an online course exam.

The student's response must be evaluated strictly based on the following JSON schema:
{
  "score": number, // 0 to 100
  "isCorrect": boolean,
  "grammarCorrections": [
    { "original": string, "correction": string, "reason": string }
  ],
  "pronunciationFeedback": string,
  "duolingoFeedback": string // Short, encouraging Duolingo-style text (e.g., "Great job! Watch out for past tense.")
}

Evaluate the response based on grammar, pronunciation, and correctness. Provide constructive feedback in the "duolingoFeedback" field. Respond with strict JSON matching the schema above.`;

  // callTextModel() (aiAgentService.ts) already runs the full resilience
  // chain: gemini-flash-latest → gemini-flash-lite-latest → gemini-3.5-flash
  // (2 attempts each on a retryable 503/429), then falls through to Azure
  // OpenAI (azureOpenAiService.ts) if that's configured and every Gemini
  // model failed. A single Gemini hiccup — or a full Google-side outage, if
  // Azure is set up — no longer surfaces as "გამოცდის გენერაცია ვერ
  // მოხერხდა" here; the route's own FALLBACK_QUESTIONS static bank remains
  // the last resort if this whole chain is exhausted or unconfigured.
  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.7);
  } catch (err) {
    throw new AiExamGenerationError(err instanceof AiAgentError ? err.message : 'AI exam generation request failed.');
  }
  if (!raw) throw new AiExamGenerationError('AI provider returned an empty response.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); // Remove extra backticks if present
  } catch {
    throw new AiExamGenerationError('AI provider returned malformed JSON.');
  }

  const result = questionsResponseSchema.safeParse(parsed);
  // Previously only checked for exactly zero questions — a schema-valid
  // response with, say, 9 of the 15 requested questions passed straight
  // through (.slice(0, questionCount) is a no-op on a shorter array), so a
  // scored exam could silently ship fewer questions than the platform's
  // own "N questions, need X% correct" framing promised the student. Any
  // shortfall is now treated the same as total generation failure — for
  // freelancerExam.ts specifically (the caller QA found this against),
  // that routes straight into the existing static-fallback bank, which
  // always fills to exactly QUESTION_COUNT; other callers (course
  // certification exams, business exam proctoring) already return a clean
  // error to the client rather than crash — see their own route handlers.
  if (!result.success || result.data.questions.length < params.questionCount) {
    throw new AiExamGenerationError('AI provider returned an unexpected question format.');
  }

  return result.data.questions.slice(0, params.questionCount).map((q, i) => ({ id: `q${i + 1}`, ...q }));
}
