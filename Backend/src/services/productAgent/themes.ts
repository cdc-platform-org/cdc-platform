/**
 * Product agent — theme pools and the "what to make next" context.
 * Exports: THEME_POOLS, pickThemeContext, ThemeContext, themeNotes.
 *
 * Pools hold evergreen, broadly popular themes for each category (styles
 * and subjects only — never a named artist, brand or character). Each run
 * draws a theme not used recently and also passes the category's
 * best-selling and recent titles to the AI, so output leans toward what
 * sells here and does not repeat itself.
 */
import { prisma } from '../../lib/prisma';
import { AGENT_CATEGORIES, AgentCategoryKey } from './categories';
import { getThemeOutcomes, TrendTheme } from './trends';

export const THEME_POOLS: Record<AgentCategoryKey, string[]> = {
  PRINTS: [
    'impasto oil-painting florals in vivid colours',
    'boho abstract arches and suns in terracotta, sand and sage',
    'mid-century modern abstract landscape with layered hills',
    'vintage botanical study of wildflowers on aged paper',
    'japandi ink-wash mountains and mist, minimal',
    'soft coastal watercolour seascapes and dunes',
    'neutral abstract textured shapes in beige and black',
    'retro 70s groovy flowers in warm tones',
    'watercolour nursery animals (bear, rabbit, fox) in pastel tones',
    'Tbilisi old-town balconies and rooftops in warm watercolour',
    'Georgian vineyards and the Caucasus at golden hour, modern illustration',
    'celestial moon phases and stars, boho gold and navy',
    'tropical leaves and monstera, modern botanical',
    'kitchen art: fruits and lemons, bright Mediterranean illustration',
    'moody still life with dark background, classical painting feel',
    'fine-line black and white architecture sketches',
    'pastel abstract colour-field washes',
    'cut-paper organic shapes in bold primary colours',
  ],
  KIDS_WORKSHEETS: [
    'Georgian alphabet coloring and tracing (letters ა–ე with animals)',
    'counting 1–10 with farm animals',
    'coloring pages: forest animals',
    'coloring pages: under the sea',
    'coloring pages: dinosaurs',
    'Georgian alphabet tracing (letters ვ–ლ)',
    'shapes and colours for preschoolers',
    'seasons and weather coloring pages',
  ],
  PLANNERS: [
    'weekly planner + habit tracker, minimal neutral',
    'monthly budget planner and expense tracker',
    'student study planner and exam countdown',
    'daily planner with priorities and gratitude',
    'fitness and water-intake tracker',
    'meal planner with grocery list',
    'reading log and book tracker',
    'small business monthly planner (orders, income, content)',
  ],
  CV_TEMPLATES: [
    'modern minimal CV with a sidebar, navy accent',
    'clean one-page CV for a first job / graduate',
    'creative CV with a photo, teal accent',
    'classic professional CV, serif headings',
    'IT / developer CV with skills bars',
    'two-colour CV for marketing and sales roles',
  ],
  BUSINESS_TEMPLATES: [
    'beauty salon price list and promo flyer',
    'café menu (A4) with daily specials',
    'small online shop: thank-you card and discount coupon',
    'coffee shop loyalty card and business card',
    'real estate listing flyer',
    'fitness studio class timetable',
    'bakery price list and gift voucher',
  ],
  INVITATIONS: [
    'children’s birthday party invitation with balloons',
    'elegant wedding invitation with eucalyptus greenery',
    'baby shower invitation in pastel watercolour',
    'christening (ნათლობა) invitation, gentle and classic',
    'New Year party invitation, gold and navy',
    'graduation party invitation',
    'save-the-date card with floral corners',
  ],
  EXAM_PREP: [
    'English vocabulary B1: 100 essential words with a practice quiz',
    'English grammar: present tenses cheat sheet with exercises',
    'Mathematics: percentages and proportions practice sheet with answers',
    'English irregular verbs list with a self-test',
    'Job interview preparation: common questions and answer frameworks',
    'Excel basics cheat sheet with practice tasks',
  ],
};

export interface ThemeContext {
  theme: string;
  styleNotes?: string;
  bestSellers: string[];
  recentTitles: string[];
  // What the agent learned from earlier products: what sold / was approved
  // and what the admin rejected and why.
  lessons: string[];
}

// Weighted random pick: earlier (better-ranked) entries are likelier.
function pickWeighted<T>(items: T[]): T {
  const weights = items.map((_, i) => items.length - i);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[0];
}

const BRIEF_MAX_AGE_MS = 21 * 86_400_000;

export async function pickThemeContext(category: AgentCategoryKey): Promise<ThemeContext> {
  const storeCategory = AGENT_CATEGORIES[category].storeCategory;
  const [recentRuns, bestSellers, recentProducts, brief, outcomes] = await Promise.all([
    prisma.productAgentRun.findMany({ where: { category }, orderBy: { startedAt: 'desc' }, take: 40, select: { theme: true } }),
    prisma.digitalProduct.findMany({
      where: { category: storeCategory, status: 'APPROVED', salesCount: { gt: 0 } },
      orderBy: { salesCount: 'desc' },
      take: 5,
      select: { titleEn: true, title: true },
    }),
    prisma.digitalProduct.findMany({ where: { category: storeCategory }, orderBy: { createdAt: 'desc' }, take: 30, select: { titleEn: true, title: true } }),
    prisma.productAgentTrendBrief.findFirst({ where: { category }, orderBy: { createdAt: 'desc' } }),
    getThemeOutcomes(category),
  ]);
  const used = new Set(recentRuns.map((r) => r.theme).filter(Boolean));
  const rejected = new Set(outcomes.filter((o) => o.outcome === 'REJECTED' || o.outcome === 'DELETED').map((o) => o.theme));
  const briefThemes = brief && Date.now() - brief.createdAt.getTime() < BRIEF_MAX_AGE_MS ? (brief.themes as unknown as TrendTheme[]) : [];

  // Mostly follow this week's brief; sometimes explore the evergreen pool.
  let chosen: { theme: string; styleNotes?: string } | undefined;
  const freshBrief = briefThemes.filter((t) => !used.has(t.theme) && !rejected.has(t.theme));
  if (freshBrief.length && Math.random() < 0.85) chosen = pickWeighted(freshBrief);
  if (!chosen) {
    const pool = THEME_POOLS[category].filter((t) => !rejected.has(t));
    const fresh = pool.filter((t) => !used.has(t));
    const list = fresh.length ? fresh : pool.length ? pool : THEME_POOLS[category];
    chosen = { theme: list[Math.floor(Math.random() * list.length)] };
  }

  const lessons = [
    ...outcomes.filter((o) => o.outcome === 'SOLD').slice(0, 5).map((o) => `SOLD${o.sales > 1 ? ` x${o.sales}` : ''}: ${o.title ?? o.theme}`),
    ...outcomes.filter((o) => o.outcome === 'APPROVED').slice(0, 3).map((o) => `approved by admin: ${o.title ?? o.theme}`),
    ...outcomes.filter((o) => o.outcome === 'REJECTED' && o.reason).slice(0, 5).map((o) => `REJECTED (${o.reason}): ${o.title ?? o.theme}`),
    ...outcomes.filter((o) => o.outcome === 'DELETED').slice(0, 3).map((o) => `deleted by admin${o.reason ? ` (${o.reason})` : ''} — avoid similar: ${o.theme}`),
  ];

  return {
    theme: chosen.theme,
    styleNotes: chosen.styleNotes,
    bestSellers: bestSellers.map((p) => p.titleEn || p.title),
    recentTitles: recentProducts.map((p) => p.titleEn || p.title),
    lessons,
  };
}

// The shared "context" paragraph every generator appends to its prompt.
export function themeNotes(t: ThemeContext): string {
  return [
    t.styleNotes ? `Style direction from this week's market brief: ${t.styleNotes}.` : '',
    t.bestSellers.length ? `Store best sellers in this category (lean toward what sells, never copy): ${t.bestSellers.join('; ')}.` : '',
    t.lessons.length ? `Lessons from our earlier products — repeat what worked, avoid what the admin rejected:\n- ${t.lessons.join('\n- ')}` : '',
    `Do not repeat these existing titles: ${t.recentTitles.join('; ') || 'none'}.`,
  ]
    .filter(Boolean)
    .join('\n');
}
