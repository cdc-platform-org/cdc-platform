import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

import { z } from 'zod';
import * as Sentry from '@sentry/node';
import { GEMINI_API_KEY } from '../utils/env';
import { GEMINI_REQUEST_OPTIONS } from '../utils/geminiRequestOptions';
import { isAzureOpenAiConfigured, generateJsonViaAzureOpenAI } from './azureOpenAiService';
import { callTextModel, isAiAgentConfigured, AiAgentError, InlineImagePart } from './aiAgentService';

// AI question generation + practical-answer grading for the AI Proctored
// Exam & Skill Assessment System (ExamSession/ExamQuestion/ExamSubmission).
// Same shape/reasoning as skillTestService.ts (N multiple-choice + 1
// AI-graded open-ended practical question) — the difference here is the
// question set is generated ONCE per ExamSession and persisted as
// ExamQuestion rows (see that model's own comment), not regenerated per
// attempt, since every candidate for a given exam needs the identical set.

// generateJson() below falls back to Azure OpenAI when Gemini is missing or
// down, so either provider is enough — the old Gemini-only check returned
// 501 "not configured" on a server that only had Azure set up.
export function isExamProctoringConfigured(): boolean {
  return !!GEMINI_API_KEY || isAzureOpenAiConfigured();
}

// Extracts exam source material (photographed textbook page, slide,
// whiteboard, scanned worksheet) straight from image bytes — Gemini reads
// images natively, so this is a one-shot text-extraction call via
// aiAgentService's shared helper rather than this file's own
// exam-question-generation model/fallback/billing machinery below, which
// is unrelated to this step. The extracted text then flows into
// generateExamQuestions() as an ordinary `rawContent` string, same as a
// parsed PDF/DOCX upload or a video transcript — see
// routes/examProctoring.ts's /sessions/parse-source-image.
export async function extractExamSourceFromImage(image: InlineImagePart): Promise<string> {
  if (!isAiAgentConfigured()) {
    throw new ExamProctoringAiError('AI is not configured yet.', 501);
  }
  const prompt =
    'Extract and transcribe ALL educational content visible in this image — text, questions, diagrams (describe them in words), tables, code, formulas — as clean Markdown. This will be used as source material for generating exam questions, so be thorough and accurate; do not summarize or omit content. If the image contains no legible educational content, respond with exactly: NO_CONTENT_FOUND';
  let text: string;
  try {
    text = (await callTextModel(prompt, 0.2, [image])).trim();
  } catch (err) {
    if (err instanceof AiAgentError) throw new ExamProctoringAiError(err.message, err.status);
    throw new ExamProctoringAiError('Failed to extract content from this image.');
  }
  if (!text || text === 'NO_CONTENT_FOUND') {
    throw new ExamProctoringAiError('No readable educational content was found in this image.', 400);
  }
  return text;
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
  // HTTP status a route should respond with — see classifyGeminiErrorStatus.
  status: number;
  constructor(message: string, status: number = 502) {
    super(message);
    this.name = 'ExamProctoringAiError';
    this.status = status;
  }
}

function isRetryableGeminiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(503|429)\b/.test(message) || /overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(message);
}

// AUDIT NOTE (fixed): the "fail fast, don't burn through the other models"
// reasoning above the loop below holds for a bad key/quota (identical
// failure on every model, same client) but NOT for a retired/renamed
// "-latest" alias 404ing — that's specific to one model name, and the loop
// used to `break geminiLoop` on it anyway, aborting the whole cascade on the
// very first model instead of trying the other two.
function isModelNotFoundError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 404) return true;
  const message = err instanceof Error ? err.message : String(err);
  return /is not found for API version|not supported for generateContent/i.test(message);
}

// Maps a Gemini failure to the HTTP status a route should respond with —
// same reasoning/thresholds as aiAgentService's identical classifier
// (duplicated rather than imported, matching this file's own comment on
// why the retry loop itself is a local copy too).
function classifyGeminiErrorStatus(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err);
  if (/\b429\b/.test(message) || /RESOURCE_EXHAUSTED|quota/i.test(message)) return 429;
  if (/\b503\b/.test(message) || /UNAVAILABLE|overloaded|high demand/i.test(message)) return 503;
  return 502;
}

export interface GeminiJsonResult {
  raw: string;
  usage?: { promptTokens: number; completionTokens: number };
}

async function generateJson(prompt: string, temperature: number): Promise<GeminiJsonResult> {
  if (!client) {
    // No Gemini key at all — Azure OpenAI (the 4th-rung cross-vendor
    // fallback, see azureOpenAiService.ts) still counts as "configured" for
    // this feature if it's set up on its own, same as any Gemini model
    // succeeding would. Falls through to the identical not-configured error
    // below only when neither provider is set up.
    if (isAzureOpenAiConfigured()) return generateJsonViaAzureOpenAI(prompt, temperature);
    throw new ExamProctoringAiError('Gemini is not configured (GEMINI_API_KEY missing).');
  }

  let lastErr: unknown;
  // A non-retryable error (bad key, quota hard-dead, etc.) stops the Gemini
  // side immediately rather than burning through the other two models with
  // an error that will obviously repeat identically on all three (they
  // share the same client/key) — but it still has to fall through to the
  // Azure attempt below, not throw from inside this loop, since that error
  // shape is exactly what a real Gemini-wide outage looks like in practice
  // (a 503/429 exhausting retries is the other, and both need the same
  // cross-vendor fallback).
  geminiLoop: for (const modelName of MODEL_FALLBACK_SEQUENCE) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const model = client.getGenerativeModel(
          { model: modelName, generationConfig: { responseMimeType: 'application/json', temperature } },
          GEMINI_REQUEST_OPTIONS
        );
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
        if (isModelNotFoundError(err)) break;
        if (!isRetryableGeminiError(err)) break geminiLoop;
        if (attempt < ATTEMPTS_PER_MODEL) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  // Every Gemini model in the fallback chain failed — try the cross-vendor
  // 4th rung before giving up. This is deliberately last, not first or
  // interleaved: Gemini is cheaper/faster and already proven reliable
  // enough that it should win whenever it's up at all; Azure OpenAI only
  // needs to be there for the case Gemini itself (not just one model) is
  // down. A no-op when AZURE_OPENAI_* isn't configured — same as today.
  if (isAzureOpenAiConfigured()) {
    try {
      return await generateJsonViaAzureOpenAI(prompt, temperature);
    } catch (azureErr) {
      console.error('[examProctoringService] Azure OpenAI fallback also failed:', azureErr instanceof Error ? azureErr.message : azureErr);
      lastErr = azureErr;
    }
  }

  // Every model in the fallback chain failed — the route handler that called
  // us catches this and responds directly (see routes/examProctoring.ts),
  // so it never reaches Sentry.setupExpressErrorHandler in server.ts.
  // Reported explicitly here instead, since exam generation/grading going
  // fully down is exactly the kind of thing worth an alert.
  Sentry.captureException(lastErr);
  throw lastErr instanceof ExamProctoringAiError
    ? lastErr
    : new ExamProctoringAiError(
        lastErr instanceof Error ? `Gemini request failed: ${lastErr.message}` : 'Gemini request failed.',
        classifyGeminiErrorStatus(lastErr)
      );
}

const mcqSchema = z.object({
  question: z.string().min(1),
  options: z.object({ A: z.string().min(1), B: z.string().min(1), C: z.string().min(1), D: z.string().min(1) }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  // Shown to the student in their results. Optional so one missing
  // explanation never fails a whole (paid) generation call — results simply
  // show no explanation for that question.
  explanation: z.string().optional(),
});
const practicalSchema = z.object({
  question: z.string().min(1),
  rubric: z.string().min(1),
});
const generationResponseSchema = z.object({
  mcqQuestions: z.array(mcqSchema).min(1),
  // Optional in the schema: omitted when includePracticalQuestion is false.
  // generateExamQuestions checks it's present when it was requested.
  practicalQuestion: practicalSchema.optional(),
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
  explanation?: string;
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
  // Defaults to true (previous behaviour). false = multiple-choice only.
  includePracticalQuestion?: boolean;
}

// How much uploaded/pasted source text is sent to the model. 8k used to cut
// a textbook chapter off after a couple of pages, so questions only ever
// covered the beginning of the material.
const SOURCE_CONTEXT_CHARS = 40000;

// Generates mcqCount multiple-choice questions, exactly 1 open-ended
// practical question, and optionally 1 code question — scoped to the
// business's free-text `topic` (e.g. "Senior React Developer — hooks,
// state management, performance") plus any uploaded source material.
export async function generateExamQuestions(params: GenerateExamQuestionsParams): Promise<GeneratedExamQuestion[]> {
  const includePractical = params.includePracticalQuestion !== false;
  const source = params.rawContent?.trim() ? params.rawContent.trim().slice(0, SOURCE_CONTEXT_CHARS) : '';

  // With source material (pasted text / PDF / photo / video transcript) the
  // questions must come FROM that material — this is how a teacher builds a
  // test from a lesson. Without it, fall back to the topic alone.
  const sourceBlock = source
    ? `\n\nSOURCE MATERIAL (the exam must be based on this content):\n"""\n${source}\n"""\n\nBase every question on facts, concepts and examples that actually appear in the SOURCE MATERIAL above. Cover the whole material evenly (beginning, middle and end), not just the first part. Do not ask about things the material does not contain.`
    : '';
  const languageRule = `\n\nLANGUAGE: write every question, option, explanation${includePractical ? ', practical question and rubric' : ''} in the same language as the ${source ? 'source material' : 'topic text'} (for example, Georgian material → Georgian questions). Keep code, formulas and technical terms exactly as written.`;
  const mcqRules = `\n\nMultiple-choice rules: exactly 4 options (A, B, C, D), exactly one clearly correct answer, plausible distractors of similar length, no "all of the above" / "none of the above", no two questions testing the same fact. Distribute the correct letter roughly evenly across A, B, C and D. For every question also write an "explanation": 1-3 short sentences a student reads after the exam, saying why the correct answer is right (and, where useful, why the most tempting wrong option is wrong). Do not refer to option letters in the explanation, since each student sees the options in a different order; refer to the answer by its content.`;

  const practicalInstruction = includePractical
    ? `\n\nThen generate exactly 1 open-ended practical question that asks the test-taker to explain or apply the material in their own words (a few sentences of free-text answer expected). Also produce a grading rubric for that question — a short paragraph describing what a strong answer should include, for an AI grader to score against later.`
    : '';
  const codeInstruction = params.includeCodeQuestion
    ? `\n\nThen generate exactly 1 coding question that asks the test-taker to write or describe an implementation for a realistic problem related to "${params.topic}". Also produce a grading rubric for it — what a strong, correct, well-structured solution should include.`
    : '';
  const practicalShapeField = includePractical ? `, "practicalQuestion": {"question": string, "rubric": string}` : '';
  const codeShapeField = params.includeCodeQuestion ? `, "codeQuestion": {"question": string, "rubric": string}` : '';

  const prompt = `You are an experienced teacher and assessment designer building a fair, high-quality exam. Topic / subject: "${params.topic}".${sourceBlock}

Generate exactly ${params.mcqCount} multiple-choice questions that test real understanding — a mix of recall, comprehension and applied/scenario questions (not trivia).${mcqRules}${practicalInstruction}${codeInstruction}${languageRule}

Respond with strict JSON matching this shape:
{"mcqQuestions": [{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A"|"B"|"C"|"D", "explanation": string}]${practicalShapeField}${codeShapeField}}`;

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
  // Same gap as aiExamService.generateExamQuestions had (found auditing
  // that one): a schema-valid response with fewer than params.mcqCount
  // questions previously passed straight through, silently shipping the
  // employer a shorter exam than they configured. There's no static
  // fallback bank for this business-exam-proctoring path (see this
  // function's own header comment), so failing loudly here — caught by
  // both routes/examProctoring.ts call sites already, which return a
  // clean error response — is strictly better than silently degrading a
  // paid, employer-configured screening exam.
  if (result.data.mcqQuestions.length < params.mcqCount) {
    throw new ExamProctoringAiError('Gemini returned fewer questions than requested.');
  }
  if (includePractical && !result.data.practicalQuestion) {
    throw new ExamProctoringAiError('Gemini returned an unexpected question format.');
  }

  const mcqQuestions: GeneratedMcqQuestion[] = result.data.mcqQuestions
    .slice(0, params.mcqCount)
    .map((q, i) => ({ type: 'MCQ', order: i, ...q, explanation: q.explanation?.trim() || undefined }));
  const questions: GeneratedExamQuestion[] = [...mcqQuestions];
  if (includePractical && result.data.practicalQuestion) {
    questions.push({ type: 'PRACTICAL', order: questions.length, ...result.data.practicalQuestion });
  }
  if (result.data.codeQuestion) {
    questions.push({ type: 'CODE', order: questions.length, ...result.data.codeQuestion });
  }
  return questions;
}

const explanationsResponseSchema = z.object({
  explanations: z.array(z.object({ id: z.string(), explanation: z.string() })),
});

// Writes the student-facing explanation for multiple-choice questions that
// don't have one yet (exams created before explanations were generated
// together with the questions). One call for the whole batch; returns
// { [questionId]: explanation } for the ones the model answered.
export async function generateMcqExplanations(params: {
  topic: string;
  questions: { id: string; question: string; options: { A: string; B: string; C: string; D: string }; correctAnswer: string }[];
}): Promise<Record<string, string>> {
  if (params.questions.length === 0) return {};
  const list = params.questions
    .map((q) => {
      const correctText = (q.options as Record<string, string>)[q.correctAnswer] ?? '';
      return JSON.stringify({ id: q.id, question: q.question, options: Object.values(q.options), correctAnswer: correctText });
    })
    .join('\n');
  const prompt = `You are a helpful teacher. Topic: "${params.topic}". For each multiple-choice question below, write a short explanation (1-3 sentences) that a student reads after the exam: why the correct answer is right and, where useful, why the most tempting wrong option is wrong. Write each explanation in the same language as its question. Do not mention option letters; refer to answers by their content.

Questions (one JSON object per line):
${list}

Respond with strict JSON matching this shape:
{"explanations": [{"id": string, "explanation": string}]}`;

  const { raw } = await generateJson(prompt, 0.3);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ExamProctoringAiError('Gemini returned malformed JSON.');
  }
  const result = explanationsResponseSchema.safeParse(parsed);
  if (!result.success) throw new ExamProctoringAiError('Gemini returned an unexpected explanation format.');
  const wanted = new Set(params.questions.map((q) => q.id));
  const out: Record<string, string> = {};
  for (const e of result.data.explanations) {
    if (wanted.has(e.id) && e.explanation.trim()) out[e.id] = e.explanation.trim();
  }
  return out;
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
  examEndTime: Date; // New parameter for server-side timer validation
}): Promise<PracticalGradeResult> {
  const now = new Date();
  if (now > params.examEndTime) {
    throw new ExamProctoringAiError('Submission rejected: Exam time has expired.', 403);
  }
  const framing =
    params.questionType === 'CODE'
      ? 'a coding question — evaluate correctness, structure, and whether it actually solves the problem, not just style'
      : 'a practical, open-ended screening question';
  const prompt = `You are grading a test-taker's answer (a student or a job candidate) to ${framing} for the topic "${params.topic}". Write the feedback in the same language as the question.

Question: ${params.question}
Grading rubric (what a strong answer should include): ${params.rubric}
Candidate's answer: ${params.answer || '(no answer submitted)'}

Score the answer from 0 to 100 based on how well it demonstrates real competence per the rubric — a genuinely strong, specific, correct answer should score 80+; a vague, generic, or incorrect answer should score well below that. Also write feedback (1-3 sentences) addressed to the test-taker: what was good, and what was missing or wrong compared with a strong answer. The teacher reads the same feedback.

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
