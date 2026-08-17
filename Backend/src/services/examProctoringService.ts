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
  // Present only when includeCodeQuestion was requested — see
  // generateExamQuestions's own comment.
  codeQuestion: practicalSchema.optional(),
});

export interface GeneratedMcqQuestion {
  type: 'MCQ';
  order: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
}
export interface GeneratedOpenQuestion {
  type: 'PRACTICAL' | 'CODE';
  order: number;
  question: string;
  // The AI grading rubric — stored in ExamQuestion.correctAnswer (dual-
  // purpose field, see that model's own comment), never shown to candidates.
  rubric: string;
}
export type GeneratedExamQuestion = GeneratedMcqQuestion | GeneratedOpenQuestion;

export interface GenerateExamQuestionsParams {
  topic: string;
  mcqCount: number;
  // Parsed text from an optional PDF/DOCX exam-source upload (job
  // description, existing test bank, etc.) — appended as grounding context
  // so questions reference the business's actual material, not just the
  // free-text topic alone.
  rawContent?: string;
  // Adds one additional AI-graded question asking the candidate to write
  // or describe code, distinct from the open-ended PRACTICAL question.
  includeCodeQuestion?: boolean;
}

// Generates mcqCount multiple-choice questions, exactly 1 open-ended
// practical question, and optionally 1 code question — scoped to the
// business's free-text `topic` (e.g. "Senior React Developer — hooks,
// state management, performance") plus any uploaded source material.
export async function generateExamQuestions(params: GenerateExamQuestionsParams): Promise<GeneratedExamQuestion[]> {
  const contextBlock = params.rawContent
    ? `\n\nAdditional source material provided by the employer (job description, existing test bank, or reference document) — ground the questions in this where relevant:\n${params.rawContent.slice(0, 8000)}`
    : '';
  const codeInstruction = params.includeCodeQuestion
    ? `\n\nThen generate exactly 1 coding question that asks the candidate to write or describe an implementation for a realistic problem related to "${params.topic}". Also produce a grading rubric for it — what a strong, correct, well-structured solution should include.`
    : '';
  const codeShapeField = params.includeCodeQuestion ? `, "codeQuestion": {"question": string, "rubric": string}` : '';

  const prompt = `You are building a professional candidate-screening exam for an employer. The role/topic being tested is: "${params.topic}".${contextBlock}

Generate exactly ${params.mcqCount} multiple-choice questions that test real, practical job-relevant competence — a mix of theory and applied/scenario-based questions (not trivia). Each must have exactly 4 options (A, B, C, D) and one correct answer.

Then generate exactly 1 open-ended practical question that asks the candidate to describe how they would approach a realistic task or problem related to "${params.topic}" (a few sentences of free-text answer expected). Also produce a grading rubric for that practical question — a short paragraph describing what a strong, competent answer should include, for an AI grader to score against later.${codeInstruction}

Respond with strict JSON matching this shape:
{"mcqQuestions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D"}], "practicalQuestion": {"question": string, "rubric": string}${codeShapeField}}`;

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
  const questions: GeneratedExamQuestion[] = [
    ...mcqQuestions,
    { type: 'PRACTICAL', order: mcqQuestions.length, ...result.data.practicalQuestion },
  ];
  if (result.data.codeQuestion) {
    questions.push({ type: 'CODE', order: questions.length, ...result.data.codeQuestion });
  }
  return questions;
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

// Grades a candidate's free-text or code answer against the rubric
// generateExamQuestions() produced for it. No non-AI fallback — same
// posture as skillTestService.gradePracticalAnswer, for the same reason (an
// open-ended answer can't be auto-graded without it).
export async function gradePracticalAnswer(params: {
  topic: string;
  questionType: 'PRACTICAL' | 'CODE';
  question: string;
  rubric: string;
  answer: string;
}): Promise<PracticalGradeResult> {
  const framing =
    params.questionType === 'CODE'
      ? 'a coding question — evaluate correctness, structure, and whether it actually solves the problem, not just style'
      : 'a practical, open-ended screening question';
  const prompt = `You are grading a job candidate's answer to ${framing} for the role/topic "${params.topic}".

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

const aiTextScoreResponseSchema = z.object({
  aiGeneratedLikelihood: z.number().min(0).max(100),
});

export interface AiTextScoreResult {
  score: number;
  usage?: { promptTokens: number; completionTokens: number };
}

// Best-effort heuristic for whether a candidate's written answer looks
// AI-generated — see ExamSubmission.aiTextScore's own schema comment on why
// this is advisory, not a certainty. Skipped entirely for very short
// answers (nothing meaningful to assess), returning null from the caller
// rather than a misleadingly confident number.
export async function estimateAiTextScore(answer: string): Promise<AiTextScoreResult> {
  const prompt = `You are assessing whether the following written answer to a job-screening question was likely generated by an AI language model rather than written by the candidate themselves. Consider generic phrasing, unnatural uniformity, lack of first-person specificity, and overly polished structure as signals of AI generation; consider typos, informal phrasing, and concrete personal detail as signals of human authorship. This is a heuristic estimate, not a certain determination.

Answer to assess:
${answer}

Respond with strict JSON matching this shape:
{"aiGeneratedLikelihood": number} // 0 = clearly human-written, 100 = clearly AI-generated`;

  const { raw, usage } = await generateJson(prompt, 0.2);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExamProctoringAiError('Gemini returned a malformed AI-detection response.');
  }

  const result = aiTextScoreResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExamProctoringAiError('Gemini returned an unexpected AI-detection format.');
  }
  return { score: result.data.aiGeneratedLikelihood, usage };
}

const studyGuideResponseSchema = z.object({
  guideText: z.string().min(1),
});

export interface StudyGuideResult {
  guideText: string;
  usage?: { promptTokens: number; completionTokens: number };
}

// One short, focused study guide covering exactly the topics a candidate
// scored below the pass mark on — not a full course, a "here's what to
// review before a retest" pointer. weakTopics are question texts
// (truncated), not a separate taxonomy — see AdaptiveStudyGuide's own
// schema comment on why no separate topic-tagging field exists.
export async function generateAdaptiveStudyGuide(params: { topic: string; weakTopics: string[] }): Promise<StudyGuideResult> {
  const prompt = `A job candidate was screened on "${params.topic}" and scored below the pass mark on questions covering these specific areas:
${params.weakTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Write a short, focused micro study guide (Markdown, a few short sections with headers) that helps the candidate specifically improve on these weak areas before a retest. Be concrete and actionable — concepts to review, common mistakes to avoid — not generic advice. Keep it concise (a few hundred words).

Respond with strict JSON matching this shape:
{"guideText": string}`;

  const { raw, usage } = await generateJson(prompt, 0.5);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExamProctoringAiError('Gemini returned a malformed study guide response.');
  }

  const result = studyGuideResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExamProctoringAiError('Gemini returned an unexpected study guide format.');
  }
  return { ...result.data, usage };
}
