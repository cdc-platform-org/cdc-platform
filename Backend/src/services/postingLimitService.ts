import { prisma } from '../lib/prisma';

// Anti-spam guard on the free Vacancy/Gig posting flow — counted together
// (not per-type) since both are "a post" from the employer's point of view
// (e.g. a logo request and a job vacancy both count toward the same 3).
// SuperAdmin is exempt (see call sites) — this only applies to regular
// Client accounts.
export const MONTHLY_POST_LIMIT = 3;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // rolling 30 days, not calendar month —
// avoids the "3 on day 30, 3 more on day 1" reset exploit a calendar-month window would allow.

export async function hasReachedMonthlyPostLimit(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [vacancyCount, gigCount] = await Promise.all([
    prisma.vacancy.count({ where: { postedById: userId, createdAt: { gte: since } } }),
    prisma.gig.count({ where: { postedById: userId, createdAt: { gte: since } } }),
  ]);
  return vacancyCount + gigCount >= MONTHLY_POST_LIMIT;
}
