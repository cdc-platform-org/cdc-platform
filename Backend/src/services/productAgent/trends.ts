/**
 * Product agent — "learning": performance feedback and weekly trend briefs.
 * Exports: ThemeOutcome, getThemeOutcomes, refreshTrendBrief, refreshAllTrendBriefs,
 * latestTrendBriefs, upcomingOccasions, TrendTheme.
 *
 * Two signals feed what the agent makes next:
 *  1. Outcomes of its own earlier products — sold, approved, still waiting,
 *     rejected (with the admin's reason) or deleted. getThemeOutcomes()
 *     reads them; themes.ts weights the next pick with them.
 *  2. A weekly brief per category (ProductAgentTrendBrief) written by Azure
 *     OpenAI from those outcomes, the store's best sellers and the Georgian
 *     season/holiday calendar for the next weeks.
 * Live web search is deliberately not used (Azure-only billing; Bing
 * grounding would need a separate Azure resource) — the model's own market
 * knowledge plus our real sales data is the input.
 */
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { RunCost, writeJson } from './ai';
import { AGENT_CATEGORIES, AGENT_CATEGORY_KEYS, AgentCategoryKey, storeCategoryValues } from './categories';

export interface ThemeOutcome {
  theme: string;
  title: string | null;
  // SOLD > APPROVED > PENDING > REJECTED/DELETED
  outcome: 'SOLD' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'DELETED';
  sales: number;
  reason: string | null;
}

export async function getThemeOutcomes(category: AgentCategoryKey, days = 120): Promise<ThemeOutcome[]> {
  const runs = await prisma.productAgentRun.findMany({
    where: { category, status: 'SUCCEEDED', startedAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: { startedAt: 'desc' },
    take: 200,
    select: { theme: true, productId: true, error: true, product: { select: { titleEn: true, title: true, status: true, salesCount: true, rejectionReason: true } } },
  });
  return runs
    .filter((r) => r.theme)
    .map((r) => {
      const p = r.product;
      const outcome: ThemeOutcome['outcome'] = !p
        ? 'DELETED'
        : p.salesCount > 0
          ? 'SOLD'
          : p.status === 'APPROVED'
            ? 'APPROVED'
            : p.status === 'REJECTED' || p.status === 'NEEDS_REVISION'
              ? 'REJECTED'
              : 'PENDING';
      return { theme: r.theme as string, title: p ? p.titleEn || p.title : null, outcome, sales: p?.salesCount ?? 0, reason: p ? p.rejectionReason ?? null : r.error?.replace(/^Deleted by admin:?\s*/, '') || null };
    });
}

// Fixed-date occasions people buy printables for in Georgia. Orthodox
// Easter moves every year, so it is described by season only.
const OCCASIONS: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: 'New Year (ახალი წელი) — biggest gifting/decor season' },
  { month: 1, day: 7, name: 'Orthodox Christmas (შობა)' },
  { month: 2, day: 14, name: "Valentine's Day" },
  { month: 3, day: 3, name: 'Mother’s Day in Georgia (დედის დღე)' },
  { month: 3, day: 8, name: 'International Women’s Day — very popular in Georgia' },
  { month: 4, day: 15, name: 'Orthodox Easter season (აღდგომა, date varies Apr–May)' },
  { month: 5, day: 26, name: 'Independence Day of Georgia' },
  { month: 6, day: 1, name: 'Children’s Day, start of summer holidays, wedding season' },
  { month: 9, day: 15, name: 'Back to school / university start (სწავლის დაწყება)' },
  { month: 10, day: 20, name: 'Tbilisoba and autumn harvest (რთველი)' },
  { month: 11, day: 25, name: 'Black Friday and pre-holiday shopping' },
  { month: 12, day: 15, name: 'Christmas / New Year decor, cards, planners for next year' },
];

export function upcomingOccasions(now = new Date(), weeks = 8): string[] {
  const out: string[] = [];
  for (const o of OCCASIONS) {
    for (const year of [now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
      const d = new Date(Date.UTC(year, o.month - 1, o.day));
      const diffDays = (d.getTime() - now.getTime()) / 86_400_000;
      if (diffDays >= -3 && diffDays <= weeks * 7) out.push(`${o.name} — in ${Math.max(0, Math.round(diffDays))} days`);
    }
  }
  return out;
}

const trendSchema = z.object({
  summary: z.string().min(20).max(1200),
  themes: z
    .array(z.object({ theme: z.string().min(5).max(140), why: z.string().min(5).max(300), styleNotes: z.string().max(300).optional() }))
    .min(8)
    .max(20),
});
export type TrendTheme = z.infer<typeof trendSchema>['themes'][number];

export async function refreshTrendBrief(category: AgentCategoryKey): Promise<{ themes: TrendTheme[]; costUsd: number }> {
  const cost = new RunCost();
  const def = AGENT_CATEGORIES[category];
  const outcomes = await getThemeOutcomes(category);
  const bestSellers = await prisma.digitalProduct.findMany({
    where: { category: { in: storeCategoryValues(category) }, status: 'APPROVED', salesCount: { gt: 0 } },
    orderBy: { salesCount: 'desc' },
    take: 8,
    select: { titleEn: true, title: true, salesCount: true },
  });
  const lines = outcomes.slice(0, 60).map((o) => `- [${o.outcome}${o.sales ? ` x${o.sales}` : ''}] ${o.theme}${o.reason ? ` — admin said: ${o.reason}` : ''}`);
  const brief = await writeJson(
    cost,
    `You are a senior market researcher for printable digital products (the kind that sell well on Etsy, Creative Market and similar shops), advising CDC Studio, an online store in Georgia whose buyers are Georgian (and some international).
Recommend what to make next in ONE category. Use your knowledge of current and rising design trends, evergreen best sellers, and the upcoming occasions given. Learn from our own results: double down on directions that SOLD or were APPROVED, drop or rethink what was REJECTED/DELETED (respect the admin's reasons), and keep ~20% exploration of fresh ideas.
Themes describe subjects/styles/audiences only — never a named artist, brand, franchise or copyrighted character.
Return JSON {"summary": "3-5 sentences on the reasoning", "themes": [10-15 {"theme": "specific, concrete product theme", "why": "short reason", "styleNotes": "palette/style/format hints"}]} ranked best first.`,
    `Category: ${def.labelEn} (store category "${def.storeCategory}").
Today: ${new Date().toISOString().slice(0, 10)}.
Upcoming occasions: ${upcomingOccasions().join('; ') || 'none soon'}.
Store best sellers in this category: ${bestSellers.map((b) => `${b.titleEn || b.title} (${b.salesCount} sold)`).join('; ') || 'none yet'}.
Our agent's recent products and outcomes:
${lines.join('\n') || '- none yet (first brief)'}`,
    trendSchema
  );
  await prisma.productAgentTrendBrief.create({ data: { category, themes: brief.themes, summary: brief.summary, costUsd: cost.usd } });
  return { themes: brief.themes, costUsd: cost.usd };
}

export async function refreshAllTrendBriefs(categories: AgentCategoryKey[] = AGENT_CATEGORY_KEYS): Promise<number> {
  let done = 0;
  for (const category of categories) {
    try {
      await refreshTrendBrief(category);
      done += 1;
    } catch (err) {
      console.error(`[product-agent] trend brief for ${category} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return done;
}

export async function latestTrendBriefs() {
  const rows = await prisma.productAgentTrendBrief.findMany({ orderBy: { createdAt: 'desc' }, take: AGENT_CATEGORY_KEYS.length * 3 });
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.category) ? false : (seen.add(r.category), true)));
}
