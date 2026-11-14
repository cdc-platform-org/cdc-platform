/**
 * Product agent — admin settings (singleton row) and spend totals.
 * Exports: ProductAgentSettingsView, getProductAgentSettings, updateProductAgentSettings,
 * getSpendSummary, settingsUpdateSchema.
 */
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AGENT_CATEGORY_KEYS, AgentCategoryKey, isAgentCategoryKey } from './categories';

// Mirrors the Prisma column defaults: the agent starts OFF with no daily
// counts, so nothing is generated (and nothing is spent) until an admin
// deliberately turns it on.
const DEFAULTS = {
  enabled: false,
  imageQuality: 'high' as 'high' | 'medium',
  monthlyBudgetUsd: 300,
  runHourUtc: 5,
};

export interface ProductAgentSettingsView {
  enabled: boolean;
  dailyCounts: Record<AgentCategoryKey, number>;
  imageQuality: 'high' | 'medium';
  monthlyBudgetUsd: number;
  runHourUtc: number;
}

function normalizeCounts(raw: unknown): Record<AgentCategoryKey, number> {
  const out = Object.fromEntries(AGENT_CATEGORY_KEYS.map((k) => [k, 0])) as Record<AgentCategoryKey, number>;
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (isAgentCategoryKey(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(0, Math.min(50, Math.floor(v)));
    }
  }
  return out;
}

export async function getProductAgentSettings(): Promise<ProductAgentSettingsView> {
  const row = await prisma.productAgentSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  return {
    enabled: row?.enabled ?? DEFAULTS.enabled,
    dailyCounts: normalizeCounts(row?.dailyCounts),
    imageQuality: row?.imageQuality === 'medium' ? 'medium' : DEFAULTS.imageQuality,
    monthlyBudgetUsd: row?.monthlyBudgetUsd ?? DEFAULTS.monthlyBudgetUsd,
    runHourUtc: row?.runHourUtc ?? DEFAULTS.runHourUtc,
  };
}

export const settingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  dailyCounts: z.record(z.string(), z.number().int().min(0).max(50)).optional(),
  imageQuality: z.enum(['high', 'medium']).optional(),
  monthlyBudgetUsd: z.number().min(0).max(5000).optional(),
  runHourUtc: z.number().int().min(0).max(23).optional(),
});

export async function updateProductAgentSettings(input: z.infer<typeof settingsUpdateSchema>): Promise<ProductAgentSettingsView> {
  const current = await getProductAgentSettings();
  const next = {
    enabled: input.enabled ?? current.enabled,
    dailyCounts: input.dailyCounts ? normalizeCounts({ ...current.dailyCounts, ...input.dailyCounts }) : current.dailyCounts,
    imageQuality: input.imageQuality ?? current.imageQuality,
    monthlyBudgetUsd: input.monthlyBudgetUsd ?? current.monthlyBudgetUsd,
    runHourUtc: input.runHourUtc ?? current.runHourUtc,
  };
  const existing = await prisma.productAgentSettings.findFirst({ orderBy: { updatedAt: 'desc' }, select: { id: true } });
  if (existing) await prisma.productAgentSettings.update({ where: { id: existing.id }, data: next });
  else await prisma.productAgentSettings.create({ data: next });
  return next;
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getSpendSummary(): Promise<{ todayUsd: number; monthUsd: number; monthProducts: number }> {
  const [today, month, monthProducts, briefsToday, briefsMonth] = await Promise.all([
    prisma.productAgentRun.aggregate({ _sum: { estimatedCostUsd: true }, where: { startedAt: { gte: startOfUtcDay() } } }),
    prisma.productAgentRun.aggregate({ _sum: { estimatedCostUsd: true }, where: { startedAt: { gte: startOfUtcMonth() } } }),
    prisma.productAgentRun.count({ where: { startedAt: { gte: startOfUtcMonth() }, status: 'SUCCEEDED' } }),
    // Trend briefs (trends.ts) are agent spend too.
    prisma.productAgentTrendBrief.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: startOfUtcDay() } } }),
    prisma.productAgentTrendBrief.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: startOfUtcMonth() } } }),
  ]);
  return {
    todayUsd: Math.round(((today._sum.estimatedCostUsd ?? 0) + (briefsToday._sum.costUsd ?? 0)) * 100) / 100,
    monthUsd: Math.round(((month._sum.estimatedCostUsd ?? 0) + (briefsMonth._sum.costUsd ?? 0)) * 100) / 100,
    monthProducts,
  };
}

export { startOfUtcDay };
