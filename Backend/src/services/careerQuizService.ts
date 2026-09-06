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

function formatAnswersTranscript(answers: Record<string, string | string[]>): string {
  return Object.entries(answers)
    .map(([question, answer]) => `- ${question}: ${Array.isArray(answer) ? answer.join(', ') : answer}`)
    .join('\n');
}

export class CareerQuizNotConfiguredError extends Error {
  constructor() {
    super('The career quiz AI is not configured on this server.');
    this.name = 'CareerQuizNotConfiguredError';
  }
}

// One-shot (not streamed/conversational) — the quiz form collects all
// answers up front before submitting. Reuses callTextModelPlain (Azure ->
// Azure -> Gemini fallback cascade) rather than standing up a second AI
// integration. Produces a deep, 3-section counselor report rather than the
// short quiz-result blurb the original version generated — gender/age
// context shapes both the tone (a parent-facing register + simplified
// vocabulary for a KID submission, a peer-to-peer career-consultant
// register for ADULT) and the specific strengths the report calls out.
export async function generateCareerQuizResult(input: QuizInput, lang: 'ka' | 'en'): Promise<string> {
  if (!isAiAgentConfigured()) throw new CareerQuizNotConfiguredError();

  const ageGroup = resolveAgeGroup(input.age);
  const catalogContext = await buildCatalogContext();
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

${catalogContext || 'No active courses or live trainings are currently published.'}

${audienceInstruction}

Write the full report in ${languageLine}, using Markdown, with EXACTLY these 3 sections, each a real, substantial paragraph (not a one-liner):

## პროფილის ანალიზი / Profile Breakdown
A thorough, specific analysis of their strengths and natural inclinations, grounded in their actual answers and their age/gender context — not generic praise.

## რეკომენდებული მიმართულება / Recommended Path
A clear, encouraging explanation of which specific digital profession/direction fits them best and WHY, tying it directly back to at least two of their specific answers.

## CDC-ის სამოქმედო გეგმა / Actionable CDC Roadmap
Name ONE specific course or live training FROM THE ACTIVE LIST ABOVE ONLY — never invent one that isn't listed. If nothing in the list is a good fit, say so honestly and suggest contacting contact@cdc.org.ge instead of forcing a match. Then give 2-3 concrete next steps (in order) for actually getting started, ending with a direct Markdown link: [/courses](/courses).

Do not include instructor/trainer/lecturer names. Do not repeat the client context back verbatim — write as prose. Output the Markdown directly — do NOT wrap the entire response in a \`\`\`markdown code fence.`;

  const raw = await callTextModelPlain(prompt, 0.7);
  // Defensive strip, not just a prompt instruction — Gemini/Azure both
  // occasionally wrap an entire prose response in a ```markdown fence
  // despite being told not to (confirmed live), which would otherwise
  // render as a single literal code block instead of styled Markdown on
  // /career-test and /dashboard/career-quiz.
  return raw.trim().replace(/^```(?:markdown)?\n?/, '').replace(/```$/, '').trim();
}
