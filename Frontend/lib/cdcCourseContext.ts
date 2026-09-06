import { formatPrice } from '../src/utils/coursePricing';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const CACHE_TTL_MS = 5 * 60 * 1000;

// Caps how many of each kind get formatted into the prompt — this codebase
// otherwise has no ceiling on active courses/live trainings, and an
// unbounded list would make every single chat turn bigger (and slower/more
// expensive) as the catalog grows. Same reasoning as chatApi.ts's own
// KNOWLEDGE_DOC_LIMIT.
const MAX_ITEMS_PER_KIND = 40;

interface CourseListItem {
  title: string;
  titleEn: string | null;
  category: string;
  status: string;
  currentPrice: number;
}

interface LiveTrainingListItem {
  title: string;
  titleEn: string | null;
  category: string;
  published: boolean;
  price: number | null;
  // Optional — a training predating the priceType/durationMonths schema
  // fields (or a backend deploy that hasn't picked up that migration yet)
  // simply falls back to a plain flat-price label below, same as CORE
  // RULE #2's "specify monthly vs total" still being satisfiable once
  // those fields are actually present.
  priceType?: 'MONTHLY' | 'TOTAL';
  durationMonths?: number | null;
}

// Mirrors src/utils/liveTrainingPricing.ts's formatLiveTrainingPriceLabel —
// duplicated (not imported) so this file has no dependency on that other,
// separately-developed feature branch; the two are free to merge to main
// in either order. Keep them in sync if the pricing rules change.
function formatTrainingPrice(t: Pick<LiveTrainingListItem, 'price' | 'priceType' | 'durationMonths'>): string {
  if (!t.price) return 'უფასო';
  const amount = formatPrice(t.price);
  if (t.priceType === 'TOTAL' || !t.priceType) return amount;
  const perMonth = `${amount} / თვეში`;
  if (!t.durationMonths || t.durationMonths <= 1) return perMonth;
  return `${perMonth} (ხანგრძლივობა: ${t.durationMonths} თვე, ჯამში ${formatPrice(t.price * t.durationMonths)})`;
}

let cached: { context: string; fetchedAt: number } | null = null;

// Real, live catalog data injected into the homepage assistant's prompt so
// it answers from what CDC is actually selling right now instead of a
// hardcoded course list that silently goes stale the moment a course is
// added, renamed, or repriced — see CAREER_ASSISTANT_SYSTEM_PROMPT's own
// "ALWAYS CHECK DYNAMIC DATABASE COURSES FIRST" rule in lib/gemini.ts.
// Fails soft: any fetch error just means the assistant falls back to
// whatever's baked into the system prompt text, same posture as
// cdcKnowledgeBase.ts's getCdcKnowledgeContext.
export async function getDynamicCourseAndTrainingContext(): Promise<string> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.context;
  }

  const [courses, liveTrainings] = await Promise.all([fetchCourses(), fetchLiveTrainings()]);

  const courseLines = courses
    .filter((c) => c.status === 'PUBLISHED')
    .slice(0, MAX_ITEMS_PER_KIND)
    .map((c) => `- **${c.title}**${c.titleEn ? ` / ${c.titleEn}` : ''} (${c.category}) — ${formatPrice(c.currentPrice)}`);

  const trainingLines = liveTrainings
    .filter((t) => t.published)
    .slice(0, MAX_ITEMS_PER_KIND)
    .map((t) => `- **${t.title}**${t.titleEn ? ` / ${t.titleEn}` : ''} (${t.category}) — ${formatTrainingPrice(t)}`);

  const context = [
    courseLines.length ? `### Active Courses (LMS)\n${courseLines.join('\n')}` : '',
    trainingLines.length ? `### Active Live Trainings\n${trainingLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  cached = { context, fetchedAt: Date.now() };
  return context;
}

async function fetchCourses(): Promise<CourseListItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/courses`);
    if (!response.ok) return [];
    const { data } = (await response.json()) as { data: CourseListItem[] };
    return data;
  } catch {
    return [];
  }
}

async function fetchLiveTrainings(): Promise<LiveTrainingListItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/live-trainings`);
    if (!response.ok) return [];
    const { data } = (await response.json()) as { data: LiveTrainingListItem[] };
    return data;
  } catch {
    return [];
  }
}
