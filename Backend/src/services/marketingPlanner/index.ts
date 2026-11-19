/**
 * Marketing planner — runner: plans a week of Facebook/Instagram posts as
 * DRAFTs, rewrites a single post on request, and the weekly auto-plan hook.
 * Exports: plannerStatus, PlannerError, planWeekPosts, rewritePost, runWeeklyAutoPlan,
 * plus settings/composeCaption re-exports.
 *
 * Stage 1: nothing is sent to Meta. An admin approves a draft, copies it into
 * Meta Business Suite and marks it published (routes/admin/adminMarketingPlanner.ts).
 */
import { prisma } from '../../lib/prisma';
import { isAzureOpenAiConfigured } from '../ai/azureOpenAiService';
import { RunCost } from '../productAgent/ai';
import { Platform, planWeek, writePost } from './agent';
import { loadCandidates, productUrl, ProductCandidate } from './candidates';
import { getPlannerSettings, nextWeekStart, slotTime, TBILISI_OFFSET_HOURS } from './settings';

export { composeCaption } from './agent';
export { getPlannerSettings, updatePlannerSettings, settingsUpdateSchema, nextWeekStart, weekStartTbilisi } from './settings';

export class PlannerError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'PlannerError';
  }
}

// One planning job at a time per instance; a week plan is ~7 model calls
// (1–2 minutes), so the route starts it in the background and the page polls.
const state: { busy: boolean; lastError: string | null; lastFinishedAt: Date | null; lastCostUsd: number } = {
  busy: false,
  lastError: null,
  lastFinishedAt: null,
  lastCostUsd: 0,
};

export function plannerStatus() {
  return { ...state, configured: isAzureOpenAiConfigured() };
}

/**
 * Plans the week starting at `weekStart` (Monday 00:00 Tbilisi). Refuses if
 * the week already has posts, unless `replaceDrafts` — then only DRAFTs are
 * replaced; approved/published posts are kept and their platform-days stay taken.
 */
export function planWeekPosts(weekStart: Date, replaceDrafts: boolean): Promise<void> {
  if (!isAzureOpenAiConfigured()) throw new PlannerError('Azure OpenAI is not configured.', 501);
  if (state.busy) throw new PlannerError('The agent is already planning — wait a minute.', 409);
  state.busy = true;
  state.lastError = null;
  const job = (async () => {
    const cost = new RunCost();
    try {
      const existing = await prisma.marketingPost.findMany({ where: { weekStart }, select: { id: true, status: true, platform: true } });
      const kept = existing.filter((p) => p.status !== 'DRAFT' && p.status !== 'REJECTED');
      if (existing.length > 0 && !replaceDrafts) throw new PlannerError('This week already has posts.', 409);

      // Approved/published posts already fill part of the week's quota.
      const base = await getPlannerSettings();
      const keptOn = (pl: string) => kept.filter((k) => k.platform === pl).length;
      const settings = {
        ...base,
        facebookPerWeek: Math.max(0, base.facebookPerWeek - keptOn('FACEBOOK')),
        instagramPerWeek: Math.max(0, base.instagramPerWeek - keptOn('INSTAGRAM')),
      };
      const candidates = await loadCandidates();
      if (candidates.length === 0) throw new PlannerError('No approved products with an image to promote.');
      const slots = await planWeek(cost, settings, candidates, weekStart);
      const byId = new Map(candidates.map((c) => [c.id, c]));

      // Write every post first, then swap the drafts in one transaction, so
      // a failure halfway leaves the old drafts untouched.
      const rows = [];
      for (const s of slots) {
        const product = byId.get(s.productId)!;
        const before = cost.usd;
        const post = await writePost(cost, settings, product, s.platform, s.angle);
        rows.push({
          platform: s.platform,
          productId: product.id,
          weekStart,
          scheduledAt: slotTime(weekStart, s.dayIndex, s.hour),
          angle: s.angle,
          caption: post.caption,
          hashtags: post.hashtags,
          productUrl: product.url,
          imageUrl: product.imageUrl,
          costUsd: cost.usd - before,
        });
      }
      await prisma.$transaction([
        prisma.marketingPost.deleteMany({ where: { weekStart, status: 'DRAFT' } }),
        prisma.marketingPost.createMany({ data: rows }),
      ]);
      console.log(`[marketing-planner] planned ${rows.length} posts for ${weekStart.toISOString()} (kept ${kept.length}), cost $${cost.usd.toFixed(3)}`);
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err);
      console.error('[marketing-planner] planning failed:', state.lastError);
    } finally {
      state.busy = false;
      state.lastFinishedAt = new Date();
      state.lastCostUsd = cost.usd;
    }
  })();
  return job;
}

// Rewrites one DRAFT's text (optionally with the admin's feedback). Synchronous:
// a single model call.
export async function rewritePost(id: string, feedback?: string) {
  if (!isAzureOpenAiConfigured()) throw new PlannerError('Azure OpenAI is not configured.', 501);
  const post = await prisma.marketingPost.findUnique({ where: { id } });
  if (!post) throw new PlannerError('Post not found.', 404);
  if (post.status !== 'DRAFT') throw new PlannerError('Only drafts can be rewritten.');
  if (!post.productId) throw new PlannerError('The product of this post no longer exists.');
  const p = await prisma.digitalProduct.findUnique({ where: { id: post.productId } });
  if (!p) throw new PlannerError('The product of this post no longer exists.');
  const product: ProductCandidate = {
    id: p.id,
    title: p.title,
    description: p.description.slice(0, 600),
    category: p.category,
    priceGel: p.price / 100,
    oldPriceGel: null,
    highlight: p.highlight,
    salesCount: p.salesCount,
    isNew: false,
    imageUrl: p.imageUrl,
    url: productUrl(p.id),
  };
  // Use the live price (a sale may have started since planning).
  const live = (await loadCandidates()).find((c) => c.id === p.id);
  const cost = new RunCost();
  const res = await writePost(cost, await getPlannerSettings(), live ?? product, post.platform as Platform, post.angle, feedback?.slice(0, 500));
  return prisma.marketingPost.update({
    where: { id },
    data: { caption: res.caption, hashtags: res.hashtags, originalCaption: null, costUsd: post.costUsd + cost.usd },
  });
}

// Called hourly by server.ts. On Fridays from 10:00 Tbilisi, plans next week
// once if the switch is on and the week is still empty.
export async function runWeeklyAutoPlan(now = new Date()): Promise<void> {
  const local = new Date(now.getTime() + TBILISI_OFFSET_HOURS * 3_600_000);
  if (local.getUTCDay() !== 5 || local.getUTCHours() < 10) return;
  const settings = await getPlannerSettings();
  if (!settings.enabled || state.busy || !isAzureOpenAiConfigured()) return;
  const week = nextWeekStart(now);
  const count = await prisma.marketingPost.count({ where: { weekStart: week } });
  if (count > 0) return;
  await planWeekPosts(week, false);
}
