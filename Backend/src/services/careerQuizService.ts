import { prisma } from '../lib/prisma';
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
// trusted from the client so careerQuizFallbackEngine.ts's tone/vocabulary
// always match the actual age submitted, not whatever flow a client claims
// it rendered.
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
// trip since this runs Backend-side already.
async function buildCatalog(): Promise<FallbackCatalogItem[]> {
  const [courses, liveTrainings] = await Promise.all([
    prisma.course.findMany({ where: { status: 'PUBLISHED' }, select: { title: true, titleEn: true, category: true } }),
    prisma.liveTraining.findMany({ where: { published: true }, select: { title: true, titleEn: true, category: true } }),
  ]);

  return [
    ...courses.map((c) => ({ title: c.title, titleEn: c.titleEn, category: c.category, kind: 'course' as const })),
    ...liveTrainings.map((t) => ({ title: t.title, titleEn: t.titleEn, category: t.category, kind: 'training' as const })),
  ];
}

// AUDIT NOTE (fixed): generateCareerQuizResult used to run a 3-tier
// pipeline — Tier 1 Gemini (up to an 8s budget) -> Tier 2 Azure OpenAI ->
// Tier 3 this same local engine — built to guarantee a result even when
// every AI provider was down. Per an explicit request to eliminate the
// 20-30s AI wait entirely for every submission (not just as a failure
// fallback), this now calls the local deterministic engine directly and
// unconditionally — no network call, no AI provider, returns in
// low-single-digit milliseconds. The AI-tier code (Gemini/Azure cascade,
// the 8s Promise.race budget, the full-prose counselor prompt) was removed
// rather than left dormant/unreachable — it's preserved in git history
// (see the commit that introduced this AUDIT NOTE) if AI-generated reports
// are ever wanted again, not kept as dead code in the meantime.
//
// CareerQuizNotConfiguredError is kept only because routes/careerQuiz.ts's
// catch block still references it defensively — no code path here raises
// it (the local engine has no "not configured" state, it just runs).
export class CareerQuizNotConfiguredError extends Error {
  constructor() {
    super('The career quiz AI is not configured on this server.');
    this.name = 'CareerQuizNotConfiguredError';
  }
}

export async function generateCareerQuizResult(input: QuizInput, lang: 'ka' | 'en'): Promise<string> {
  const catalog = await buildCatalog();
  return generateFallbackCareerReport(input, lang, catalog);
}
