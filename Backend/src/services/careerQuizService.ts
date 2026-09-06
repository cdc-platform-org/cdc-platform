import { prisma } from '../lib/prisma';
import { callTextModelPlain, isAiAgentConfigured } from './aiAgentService';

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

interface QuizAnswers {
  interests: string;
  experience: string;
  mainGoal: string;
}

// Live, published catalog at the moment of submission — same "never
// hallucinate, always check the real DB first" posture as the homepage
// assistant's CAREER_ASSISTANT_SYSTEM_PROMPT (Frontend/lib/gemini.ts),
// reimplemented here with direct Prisma access instead of an HTTP round
// trip since this runs Backend-side already.
async function buildCatalogContext(): Promise<string> {
  const [courses, liveTrainings] = await Promise.all([
    prisma.course.findMany({ where: { status: 'PUBLISHED' }, select: { title: true, titleEn: true, category: true, originalPrice: true } }),
    prisma.liveTraining.findMany({ where: { published: true }, select: { title: true, titleEn: true, category: true, price: true } }),
  ]);

  const formatGel = (minorUnits: number | null) => (minorUnits ? `${(minorUnits / 100).toFixed(2)} ₾` : 'უფასო');

  const courseLines = courses.map((c) => `- ${c.title}${c.titleEn ? ` / ${c.titleEn}` : ''} (${c.category}) — ${formatGel(c.originalPrice)}`);
  const trainingLines = liveTrainings.map((t) => `- ${t.title}${t.titleEn ? ` / ${t.titleEn}` : ''} (${t.category}) — ${formatGel(t.price)}`);

  return [
    courseLines.length ? `Active Courses:\n${courseLines.join('\n')}` : '',
    trainingLines.length ? `Active Live Trainings:\n${trainingLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export class CareerQuizNotConfiguredError extends Error {
  constructor() {
    super('The career quiz AI is not configured on this server.');
    this.name = 'CareerQuizNotConfiguredError';
  }
}

// One-shot (not streamed/conversational) — the quiz form collects all 3
// answers up front before submitting, unlike the old in-chat flow that
// asked them one at a time. Reuses callTextModelPlain (Azure -> Azure ->
// Gemini fallback cascade) rather than standing up a second AI integration.
export async function generateCareerQuizResult(answers: QuizAnswers, lang: 'ka' | 'en'): Promise<string> {
  if (!isAiAgentConfigured()) throw new CareerQuizNotConfiguredError();

  const catalogContext = await buildCatalogContext();
  const languageLine = lang === 'ka' ? 'Georgian' : 'English';

  const prompt = `You are the CDC Career Quiz consultant. A user just answered 3 questions on CDC's Career Test. Write their personalized result.

Their answers:
1. Interests: ${answers.interests}
2. Experience level: ${answers.experience}
3. Main goal: ${answers.mainGoal}

${catalogContext || 'No active courses or live trainings are currently published.'}

Write the result in ${languageLine}, using Markdown, with this exact structure:
- A short "შედეგი / Your Result" section naming the matching digital profession(s) and the best-fitting course(s)/live training(s) FROM THE ACTIVE LIST ABOVE ONLY — never invent a course that isn't listed. If nothing in the list is a good fit, say so honestly and suggest they contact contact@cdc.org.ge instead of forcing a match.
- One sentence tying the recommendation to their specific answers.
- A direct Markdown link to the courses page: [/courses](/courses).
- A short "CDC-ის ექსკლუზიური სარგებელი / Exclusive CDC Benefits" section mentioning the closed Employment Forum, direct career support, and a professional networking circle.

Do not include instructor/trainer/lecturer names. Keep it encouraging and concise.`;

  return callTextModelPlain(prompt, 0.7);
}
