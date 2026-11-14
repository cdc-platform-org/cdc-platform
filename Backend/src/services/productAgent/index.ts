/**
 * Product agent — runner: creates products one at a time, records each
 * attempt (and its cost) as a ProductAgentRun, and runs the daily batch.
 * Exports: enqueueRuns, runDailyBatch, recoverInterruptedRuns, isAgentBusy.
 *
 * Settings/spend: ./settings.ts · categories: ./categories.ts · per-category
 * generators: ./generators/ · upload + DigitalProduct row: ./publish.ts.
 * Admin API: routes/admin/adminProductAgent.ts · schedule: server.ts.
 */
import { prisma } from '../../lib/prisma';
import { isAzureImageConfigured } from '../ai/azureImageService';
import { RunCost } from './ai';
import { AGENT_CATEGORIES, AGENT_CATEGORY_KEYS, AgentCategoryKey } from './categories';
import { GENERATORS } from './generators';
import { publishDraft } from './publish';
import { getProductAgentSettings, getSpendSummary, startOfUtcDay } from './settings';
import { pickThemeContext } from './themes';
import { refreshTrendBrief } from './trends';

// One product at a time per instance: a print set holds three 2048×3072
// images plus 4800×7200 upscales in memory, and Azure image rate limits are
// per resource anyway.
let chain: Promise<void> = Promise.resolve();
let pending = 0;

export function isAgentBusy(): boolean {
  return pending > 0;
}

async function executeRun(runId: string): Promise<void> {
  const run = await prisma.productAgentRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== 'QUEUED') return;
  const category = run.category as AgentCategoryKey;
  const cost = new RunCost();
  await prisma.productAgentRun.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } });
  try {
    const settings = await getProductAgentSettings();
    const theme = await pickThemeContext(category);
    await prisma.productAgentRun.update({ where: { id: runId }, data: { theme: theme.theme } });
    const draft = await GENERATORS[category]({ cost, quality: settings.imageQuality, theme, category, priceGel: AGENT_CATEGORIES[category].defaultPriceGel });
    const productId = await publishDraft(draft);
    await prisma.productAgentRun.update({
      where: { id: runId },
      data: { status: 'SUCCEEDED', productId, imageCount: cost.images, estimatedCostUsd: cost.usd, finishedAt: new Date() },
    });
    console.log(`[product-agent] ${category} created ${productId} ($${cost.usd.toFixed(2)})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[product-agent] ${category} run ${runId} failed:`, message);
    await prisma.productAgentRun.update({
      where: { id: runId },
      // Money spent before the failure still counts toward the budget.
      data: { status: 'FAILED', error: message.slice(0, 1000), imageCount: cost.images, estimatedCostUsd: cost.usd, finishedAt: new Date() },
    });
  }
}

function schedule(runId: string): Promise<void> {
  pending += 1;
  const p = chain.then(() => executeRun(runId)).finally(() => {
    pending -= 1;
  });
  chain = p.catch(() => undefined);
  return p;
}

// Queues one product per listed category (or `count` of one). Returns the
// run ids at once; the products are built in the background.
export async function enqueueRuns(categories: AgentCategoryKey[], trigger: 'MANUAL' | 'SCHEDULE'): Promise<string[]> {
  if (!isAzureImageConfigured()) throw new Error('Azure gpt-image-2 is not configured (AZURE_IMAGE_* env).');
  const ids: string[] = [];
  for (const category of categories) {
    const run = await prisma.productAgentRun.create({ data: { category, trigger, status: 'QUEUED' } });
    ids.push(run.id);
    void schedule(run.id);
  }
  return ids;
}

// Runs left after a restart/deploy can never finish — mark them failed so
// the daily count and the admin list stay truthful.
export async function recoverInterruptedRuns(): Promise<void> {
  await prisma.productAgentRun.updateMany({
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    data: { status: 'FAILED', error: 'Interrupted by a server restart.', finishedAt: new Date() },
  });
}

// The weekly "learning" step: a category that is in use gets a new market
// brief once its latest one is a week old (trends.ts). Failure is logged and
// the batch goes on with the older brief / evergreen pool.
const BRIEF_REFRESH_MS = 7 * 86_400_000;
async function ensureFreshBrief(category: AgentCategoryKey): Promise<void> {
  const latest = await prisma.productAgentTrendBrief.findFirst({ where: { category }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
  if (latest && Date.now() - latest.createdAt.getTime() < BRIEF_REFRESH_MS) return;
  try {
    await refreshTrendBrief(category);
  } catch (err) {
    console.error(`[product-agent] weekly trend brief for ${category} failed:`, err instanceof Error ? err.message : err);
  }
}

// Called hourly. From the configured hour on, tops each category up to its
// daily count (so a restart mid-batch simply continues), and stops as soon
// as this month's spend reaches the budget. Today's runs are recounted
// before every product (all statuses), so even if two App Service
// instances fire at once they see each other's rows and don't double up.
export async function runDailyBatch(): Promise<{ queued: number; reason?: string }> {
  const settings = await getProductAgentSettings();
  if (!settings.enabled) return { queued: 0, reason: 'disabled' };
  if (new Date().getUTCHours() < settings.runHourUtc) return { queued: 0, reason: 'before run hour' };
  if (isAgentBusy()) return { queued: 0, reason: 'busy' };
  let queued = 0;
  for (const category of AGENT_CATEGORY_KEYS) {
    if (settings.dailyCounts[category] > 0) await ensureFreshBrief(category);
    for (;;) {
      const doneToday = await prisma.productAgentRun.count({ where: { category, trigger: 'SCHEDULE', startedAt: { gte: startOfUtcDay() } } });
      if (doneToday >= settings.dailyCounts[category]) break;
      const spend = await getSpendSummary();
      if (spend.monthUsd >= settings.monthlyBudgetUsd) return { queued, reason: 'monthly budget reached' };
      await enqueueRuns([category], 'SCHEDULE');
      queued += 1;
      // Wait for this product before the next one, so the budget check
      // above sees the real cost of everything already made.
      await chain;
    }
  }
  return { queued };
}
