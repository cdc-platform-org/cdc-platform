import { prisma } from '../lib/prisma';

// Anti-spam guard on the free Vacancy/Gig posting flow — counted together
// (not per-type) since both are "a post" from the employer's point of view
// (e.g. a logo request and a job vacancy both count toward the same limit).
// SuperAdmin is exempt (see call sites) — this only applies to regular
// accounts. Was a fixed 3-per-rolling-30-days cap; now a rolling 24h window
// whose limit is admin-configurable (PlatformSettings.dailyPostLimit) —
// part of the platform's "generous now, tighten later" launch-phase
// monetization strategy. Falls back to DEFAULT_DAILY_POST_LIMIT when no
// admin has saved a PlatformSettings row yet, same
// read-with-fallback pattern as billingService.getBillingSettings().
export const DEFAULT_DAILY_POST_LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function getDailyPostLimit(): Promise<number> {
  const settings = await prisma.platformSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  return settings?.dailyPostLimit ?? DEFAULT_DAILY_POST_LIMIT;
}

export async function updateDailyPostLimit(dailyPostLimit: number, updatedByEmail: string) {
  const existing = await prisma.platformSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  const data = { dailyPostLimit, updatedByEmail };
  return existing
    ? prisma.platformSettings.update({ where: { id: existing.id }, data })
    : prisma.platformSettings.create({ data });
}

export async function hasReachedDailyPostLimit(userId: string): Promise<boolean> {
  const [limit, since] = [await getDailyPostLimit(), new Date(Date.now() - WINDOW_MS)];
  const [vacancyCount, gigCount] = await Promise.all([
    prisma.vacancy.count({ where: { postedById: userId, createdAt: { gte: since } } }),
    prisma.gig.count({ where: { postedById: userId, createdAt: { gte: since } } }),
  ]);
  return vacancyCount + gigCount >= limit;
}
