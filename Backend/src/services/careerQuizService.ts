import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../lib/prisma';
import { GEMINI_API_KEY } from '../utils/env';
import { isAzureOpenAiConfigured } from './azureOpenAiService';
import { callAzureChatCompletion } from './azureChatCompletionService';
import { generateFallbackCareerReport, FallbackCatalogItem } from './careerQuizFallbackEngine';

// Same rolling-window row-count pattern as EducatorGeneration/
// TutorLessonGeneration (see schema.prisma's own comment on
// CareerQuizSubmission) — no separate resettable counter column, no cron
// reset job, and correct even across multiple server instances.
export const DAILY_QUIZ_LIMIT = 3;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function countTodaysSubmissions(userId: string): Promise<number> {
  return prisma.careerQuizSubmission.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });
}

// The 16-year boundary that decides which question set career-test.tsx
// showed (KID_QUESTIONS vs ADULT_QUESTIONS) — re-derived here rather than
// trusted from the client so the prompt's tone/vocabulary instructions
// below always match the actual age submitted, not whatever flow a client
// claims it rendered.
export type CareerQuizAgeGroup = 'KID' | 'ADULT';
export function resolveAgeGroup(age: number): CareerQuizAgeGroup {
  return age < 16 ? 'KID' : 'ADULT';
}

interface QuizInput {
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  age: number;
  // A question can be multi-select (career-test.tsx's checkbox-style
  // options), so each answer is either a single string or a non-empty
  // array of the options picked for that question.
  answers: Record<string, string | string[]>;
}

// Live, published catalog at the moment of submission — same "never
// hallucinate, always check the real DB first" posture as the homepage
// assistant's CAREER_ASSISTANT_SYSTEM_PROMPT (Frontend/lib/gemini.ts),
// reimplemented here with direct Prisma access instead of an HTTP round
// trip since this runs Backend-side already. Returns both the prompt-ready
// text block (for Tier 1/2, the real AI providers) and the structured item
// list (for Tier 3's own keyword matching, which has no LLM to read prose)
// from the same single DB round trip.
async function buildCatalog(): Promise<{ text: string; items: FallbackCatalogItem[] }> {
  const [courses, liveTrainings] = await Promise.all([
    prisma.course.findMany({ where: { status: 'PUBLISHED' }, select: { title: true, titleEn: true, category: true, originalPrice: true } }),
    prisma.liveTraining.findMany({ where: { published: true }, select: { title: true, titleEn: true, category: true, price: true } }),
  ]);

  const formatGel = (minorUnits: number | null) => (minorUnits ? `${(minorUnits / 100).toFixed(2)} ₾` : 'უფასო');

  const courseLines = courses.map((c) => `- ${c.title}${c.titleEn ? ` / ${c.titleEn}` : ''} (${c.category}) — ${formatGel(c.originalPrice)}`);
  const trainingLines = liveTrainings.map((t) => `- ${t.title}${t.titleEn ? ` / ${t.titleEn}` : ''} (${t.category}) — ${formatGel(t.price)}`);

  const text = [
    courseLines.length ? `Active Courses:\n${courseLines.join('\n')}` : '',
    trainingLines.length ? `Active Live Trainings:\n${trainingLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const items: FallbackCatalogItem[] = [
    ...courses.map((c) => ({ title: c.title, titleEn: c.titleEn, category: c.category, kind: 'course' as const })),
    ...liveTrainings.map((t) => ({ title: t.title, titleEn: t.titleEn, category: t.category, kind: 'training' as const })),
  ];

  return { text, items };
}

function formatAnswersTranscript(answers: Record<string, string | string[]>): string {
  return Object.entries(answers)
    .map(([question, answer]) => `- ${question}: ${Array.isArray(answer) ? answer.join(', ') : answer}`)
    .join('\n');
}

// AUDIT NOTE (fixed): generateCareerQuizResult used to throw
// CareerQuizNotConfiguredError / propagate a Gemini failure, which
// routes/careerQuiz.ts turned into a 501/502 the visitor saw as
// "ტესტის შედეგის გენერირება ვერ მოხერხდა" — reported live on production,
// 2026-09-06/07. Restructured into an explicit 3-tier pipeline (Tier 1
// Gemini -> Tier 2 Azure OpenAI -> Tier 3 local deterministic engine, see
// careerQuizFallbackEngine.ts) so this function now ALWAYS returns a real
// report and never throws for an AI-provider reason — only a genuine
// caller error (this file's own bug, not "the AI was down") would still
// throw. This class is kept only because routes/careerQuiz.ts's catch
// block still references it defensively; no code path in this file raises
// it anymore.
export class CareerQuizNotConfiguredError extends Error {
  constructor() {
    super('The career quiz AI is not configured on this server.');
    this.name = 'CareerQuizNotConfiguredError';
  }
}

// ============================================================
// TIER 1 — Gemini (primary). A tight, self-contained model cascade with an
// 8-second TOTAL budget for the whole tier (not per-model) — a real 429/5xx
// on one model moves to the next immediately with no retry delay, and
// whatever hasn't produced a result by the 8s mark is abandoned in favor of
// Tier 2, per spec. Deliberately separate from aiAgentService.ts's own
// Gemini cascade (which is Azure-primary, Gemini-fallback, the opposite
// priority — a deliberate, documented choice for that shared file used by
// unrelated features) rather than reordering that shared path for this one
// endpoint.
// ============================================================
const TIER1_TIMEOUT_MS = 8_000;
const TIER1_MODEL_SEQUENCE = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
const geminiClient = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'TIMEOUT'> {
  return Promise.race([promise, new Promise<'TIMEOUT'>((resolve) => setTimeout(() => resolve('TIMEOUT'), ms))]);
}

async function tier1GeminiCascade(prompt: string): Promise<string | null> {
  if (!geminiClient) return null;
  for (const modelName of TIER1_MODEL_SEQUENCE) {
    try {
      const model = geminiClient.getGenerativeModel({ model: modelName, generationConfig: { temperature: 0.7 } });
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      if (raw) return raw;
    } catch (err) {
      console.error(`[careerQuizService] Tier 1 (Gemini) ${modelName} failed:`, err instanceof Error ? err.message : err);
      // Move straight to the next model — no retry-with-delay here, the 8s
      // outer budget below is the real bound on how long Tier 1 gets.
    }
  }
  return null;
}

async function tryTier1(prompt: string): Promise<string | null> {
  const result = await withTimeout(tier1GeminiCascade(prompt), TIER1_TIMEOUT_MS);
  if (result === 'TIMEOUT') {
    console.error(`[careerQuizService] Tier 1 (Gemini) exceeded ${TIER1_TIMEOUT_MS}ms budget — failing over to Tier 2.`);
    return null;
  }
  return result;
}

// ============================================================
// TIER 2 — Azure OpenAI (backup). A genuine no-op (not a wasted network
// call) when AZURE_OPENAI_API_KEY isn't configured — see aiAgentService.ts's
// identical isAzureOpenAiConfigured() guard and its own audit note on why
// that matters (production has no Azure OpenAI credentials set at all right
// now, so this tier is structurally ready but currently always skips
// straight to Tier 3 — that's an infra/credentials gap, not a code bug).
// ============================================================
async function tryTier2(prompt: string): Promise<string | null> {
  if (!isAzureOpenAiConfigured()) return null;
  try {
    return await callAzureChatCompletion({ messages: [{ role: 'user', content: prompt }], temperature: 0.7 });
  } catch (err) {
    console.error('[careerQuizService] Tier 2 (Azure) failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

function stripMarkdownFence(raw: string): string {
  // Defensive strip, not just a prompt instruction — Gemini/Azure both
  // occasionally wrap an entire prose response in a ```markdown fence
  // despite being told not to (confirmed live), which would otherwise
  // render as a single literal code block instead of styled Markdown on
  // /career-test and /dashboard/career-quiz.
  return raw.trim().replace(/^```(?:markdown)?\n?/, '').replace(/```$/, '').trim();
}

// One-shot (not streamed/conversational) — the quiz form collects all
// answers up front before submitting. Produces a deep, 3-section counselor
// report — gender/age context shapes both the tone (a parent-facing
// register + simplified vocabulary for a KID submission, a peer-to-peer
// career-consultant register for ADULT) and the specific strengths the
// report calls out. See the 3-tier pipeline above/below: this function
// always returns a usable report, regardless of which tier produced it.
export async function generateCareerQuizResult(input: QuizInput, lang: 'ka' | 'en'): Promise<string> {
  const ageGroup = resolveAgeGroup(input.age);
  const catalog = await buildCatalog();
  const languageLine = lang === 'ka' ? 'Georgian' : 'English';
  const answersTranscript = formatAnswersTranscript(input.answers);

  const audienceInstruction =
    ageGroup === 'KID'
      ? `This quiz was taken by or on behalf of a ${input.age}-year-old (a child/teen). Write the report ADDRESSED TO THE PARENT reading it on the child's behalf — warm, encouraging, and completely free of adult career jargon (no "freelancing", "remote work", "B2B", "monetization", "income", "career change"). Frame everything in terms of the child's natural talents, curiosity, and what they'd enjoy learning next — not job titles or salaries.`
      : `This quiz was taken by a ${input.age}-year-old adult. Write the report as an expert career consultant speaking directly to them — professional, warm, and specific about real career/income/work-style implications.`;

  const prompt = `You are a senior CDC career counselor writing a personalized report after a client completed CDC's AI Career Quiz.

Client context:
- Gender: ${input.gender}
- Age: ${input.age} (${ageGroup === 'KID' ? 'child/teen' : 'adult'})

Their answers:
${answersTranscript}

${catalog.text || 'No active courses or live trainings are currently published.'}

${audienceInstruction}

Write the full report in ${languageLine}, using Markdown, with EXACTLY these 3 sections, each a real, substantial paragraph (not a one-liner):

## პროფილის ანალიზი / Profile Breakdown
A thorough, specific analysis of their strengths and natural inclinations, grounded in their actual answers and their age/gender context — not generic praise.

## რეკომენდებული მიმართულება / Recommended Path
A clear, encouraging explanation of which specific digital profession/direction fits them best and WHY, tying it directly back to at least two of their specific answers.

## CDC-ის სამოქმედო გეგმა / Actionable CDC Roadmap
Name ONE specific course or live training FROM THE ACTIVE LIST ABOVE ONLY — never invent one that isn't listed. If nothing in the list is a good fit, say so honestly and suggest contacting contact@cdc.org.ge instead of forcing a match. Then give 2-3 concrete next steps (in order) for actually getting started, ending with a direct Markdown link: [/courses](/courses).

Do not include instructor/trainer/lecturer names. Do not repeat the client context back verbatim — write as prose. Output the Markdown directly — do NOT wrap the entire response in a \`\`\`markdown code fence.`;

  const tier1Raw = await tryTier1(prompt);
  if (tier1Raw) return stripMarkdownFence(tier1Raw);

  const tier2Raw = await tryTier2(prompt);
  if (tier2Raw) return stripMarkdownFence(tier2Raw);

  console.error('[careerQuizService] Tier 1 and Tier 2 both unavailable — falling back to Tier 3 (local deterministic engine).');
  return generateFallbackCareerReport(input, lang, catalog.items);
}
