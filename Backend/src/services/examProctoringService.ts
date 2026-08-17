import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { GEMINI_API_KEY } from '../utils/env';

// AI question generation + practical-answer grading for the AI Proctored
// Exam & Skill Assessment System (ExamSession/ExamQuestion/ExamSubmission).
// Same shape/reasoning as skillTestService.ts (N multiple-choice + 1
// AI-graded open-ended practical question) — the difference here is the
// question set is generated ONCE per ExamSession and persisted as
// ExamQuestion rows (see that model's own comment), not regenerated per
// attempt, since every candidate for a given exam needs the identical set.

export function isExamProctoringConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

const client = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Same model fallback sequence as aiAgentService.callTextModel() — kept as
// a local copy rather than calling that shared helper directly because this
// file also needs the response's usageMetadata (for UsageRecord billing,
// see billingService.recordExamGradingUsage), which callTextModel() doesn't
// expose. 'gemini-flash-latest' alone was found intermittently 503ing
// ("high demand") on this account; pinning to a single alternate model
// isn't viable either — gemini-2.5-flash now hard-404s ("no longer
// available to new users"), confirmed live against this project's API key.
const MODEL_FALLBACK_SEQUENCE = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
const ATTEMPTS_PER_MODEL = 2;
const RETRY_DELAY_MS = 1500;

export class ExamProctoringAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExamProctoringAiError';
  }
}

function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(503|429)\b/.test(message) || /overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}

export interface GeminiJsonResult {
  raw: string;
  usage?: { promptTokens: number; completionTokens: number };
}

async function generateJson(prompt: string, temperature: number): Promise<GeminiJsonResult> {
  if (!client) {
    throw new ExamProctoringAiError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  let lastErr: unknown;
  for (const modelName of MODEL_FALLBACK_SEQUENCE) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json', temperature },
        });
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        if (!raw) throw new ExamProctoringAiError('Gemini returned an empty response.');
        const usageMetadata = result.response.usageMetadata;
        return {
          raw,
          usage: usageMetadata
            ? { promptTokens: usageMetadata.promptTokenCount ?? 0, completionTokens: usageMetadata.candidatesTokenCount ?? 0 }
            : undefined,
        };
      } catch (err) {
        lastErr = err;
        console.error(`[examProctoringService] ${modelName} attempt ${attempt}/${ATTEMPTS_PER_MODEL} failed:`, err instanceof Error ? err.message : err);
        if (!isRetryableGeminiError(err)) {
          throw err instanceof ExamProctoringAiError
            ? err
            : new ExamProctoringAiError(err instanceof Error ? `Gemini request failed: ${err.message}` : 'Gemini request failed.');
        }
        if (attempt < ATTEMPTS_PER_MODEL) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  throw lastErr instanceof ExamProctoringAiError
    ? lastErr
    : new ExamProctoringAiError(lastErr instanceof Error ? `Gemini request failed: ${lastErr.message}` : 'Gemini request failed.');
}

const mcqSchema = z.object({
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
});
const practicalSchema = z.object({
  question: z.string().min(1),
  rubric: z.string().min(1),
});
const generationResponseSchema = z.object({
  mcqQuestions: z.array(mcqSchema).min(1),
  practicalQuestion: practicalSchema,
});

export interface GeneratedMcqQuestion {
  type: 'MCQ';
  order: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}
export interface GeneratedPracticalQuestion {
  type: 'PRACTICAL';
  order: number;
  question: string;
  // The AI grading rubric — stored in ExamQuestion.correctAnswer (dual-
  // purpose field, see that model's own comment), never shown to candidates.
  rubric: string;
}
export type GeneratedExamQuestion = GeneratedMcqQuestion | GeneratedPracticalQuestion;

// Generates mcqCount multiple-choice questions plus exactly 1 open-ended
// practical question, scoped to the business's free-text `topic` (e.g.
// "Senior React Developer — hooks, state management, performance").
export async function generateExamQuestions(topic: string, mcqCount: number): Promise<GeneratedExamQuestion[]> {
  const prompt = `You are building a professional candidate-screening exam for an employer. The role/topic being tested is: "${topic}".

Generate exactly ${mcqCount} multiple-choice questions that test real, practical job-relevant competence — a mix of theory and applied/scenario-based questions (not trivia). Each must have exactly 4 options (A, B, C, D) and one correct answer.

Then generate exactly 1 open-ended practical question that asks the candidate to describe how they would approach a realistic task or problem related to "${topic}" (a few sentences of free-text answer expected). Also produce a grading rubric for that practical question — a short paragraph describing what a strong, competent answer should include, for an AI grader to score against later.

Respond with strict JSON matching this shape:
{"mcqQuestions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D"}], "practicalQuestion": {"question": string, "rubric": string}}`;

  const { raw } = await generateJson(prompt, 0.7);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExamProctoringAiError('Gemini returned malformed JSON.');
  }

  const result = generationResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExamProctoringAiError('Gemini returned an unexpected question format.');
  }

  const mcqQuestions: GeneratedMcqQuestion[] = result.data.mcqQuestions.map((q, i) => ({ type: 'MCQ', order: i, ...q }));
  const practicalQuestion: GeneratedPracticalQuestion = {
    type: 'PRACTICAL',
    order: mcqQuestions.length,
    ...result.data.practicalQuestion,
  };
  return [...mcqQuestions, practicalQuestion];
}

const gradeResponseSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
});

export interface PracticalGradeResult {
  score: number;
  feedback: string;
  // Surfaced so the caller (routes/examProctoring.ts) can meter this
  // grading call against the exam's BillingSubscription (see
  // billingService.recordExamGradingUsage) — undefined if Gemini's response
  // didn't include usageMetadata, same as businessAiChatService's posture.
  usage?: { promptTokens: number; completionTokens: number };
}

// Grades a candidate's free-text answer against the rubric
// generateExamQuestions() produced for it. No non-AI fallback — same
// posture as skillTestService.gradePracticalAnswer, for the same reason (an
// open-ended answer can't be auto-graded without it).
export async function gradePracticalAnswer(params: {
  topic: string;
  question: string;
  rubric: string;
  answer: string;
}): Promise<PracticalGradeResult> {
  const prompt = `You are grading a job candidate's answer to a practical screening question for the role/topic "${params.topic}".

Question: ${params.question}
Grading rubric (what a strong answer should include): ${params.rubric}
Candidate's answer: ${params.answer || '(no answer submitted)'}

Score the answer from 0 to 100 based on how well it demonstrates real competence per the rubric — a genuinely strong, specific, correct answer should score 80+; a vague, generic, or incorrect answer should score well below that. Also write one short sentence of feedback for the hiring team.

Respond with strict JSON matching this shape:
{"score": number, "feedback": string}`;

  const { raw, usage } = await generateJson(prompt, 0.3);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExamProctoringAiError('Gemini returned a malformed grading response.');
  }

  const result = gradeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExamProctoringAiError('Gemini returned an unexpected grading format.');
  }
  return { ...result.data, usage };
}
