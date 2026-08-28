import { prisma } from '../lib/prisma';

// Free-tier quota for POST /api/ai/digital-store-marketing — a fixed cap
// (unlike postingLimitService's admin-configurable one) since this is a
// convenience aid, not a monetization lever. Same rolling-24h-window-via-
// count pattern as postingLimitService.hasReachedDailyPostLimit — counts
// DigitalMarketingGeneration rows created in the last 24h rather than a
// resettable counter field, so it needs no cron/reset job and stays correct
// across multiple server instances.
export const DAILY_MARKETING_GENERATION_LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface MarketingGenerationUsage {
  used: number;
  limit: number;
}

export async function getDailyMarketingGenerationUsage(userId: string): Promise<MarketingGenerationUsage> {
  const since = new Date(Date.now() - WINDOW_MS);
  const used = await prisma.digitalMarketingGeneration.count({
    where: { userId, createdAt: { gte: since } },
  });
  return { used, limit: DAILY_MARKETING_GENERATION_LIMIT };
}

export async function hasReachedDailyMarketingGenerationLimit(userId: string): Promise<boolean> {
  const { used, limit } = await getDailyMarketingGenerationUsage(userId);
  return used >= limit;
}

export async function recordMarketingGeneration(userId: string, productId?: string): Promise<void> {
  await prisma.digitalMarketingGeneration.create({ data: { userId, productId } });
}
