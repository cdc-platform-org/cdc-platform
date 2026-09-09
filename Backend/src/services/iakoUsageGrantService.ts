import { IakoAssistantProfile, IakoGrantResource, IakoUsageGrant } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class IakoUsageError extends Error {
  constructor(public status: number, message: string, public reason: 'revoked' | 'not_started' | 'expired' | 'request_limit' | 'daily_limit' | 'hourly_limit' | 'screenshot_limit' | 'too_many_screenshots') {
    super(message);
  }
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface UsageSummary {
  requestsUsed: number; requestLimit: number | null;
  dailyUsed: number; dailyLimit: number | null;
  hourlyUsed: number; hourlyLimit: number | null;
  screenshotsUsed: number; screenshotLimit: number | null;
  maxScreenshotsPerMessage: number;
  startsAt: Date | null; expiresAt: Date | null; revokedAt: Date | null;
}

async function countSince(usageGrantId: string, since: Date): Promise<{ requests: number; screenshots: number }> {
  const logs = await prisma.iakoRequestLog.findMany({ where: { usageGrantId, createdAt: { gte: since } }, select: { screenshotCount: true } });
  return { requests: logs.length, screenshots: logs.reduce((sum, log) => sum + log.screenshotCount, 0) };
}

// The count a limit is measured against always starts at usageResetAt (an
// admin's "reset usage" moves this forward instead of deleting log rows —
// see the grant's own schema comment) — daily/hourly are additionally
// windowed to the last 24h/1h, whichever is the tighter (later) bound.
export async function usageSummary(grant: IakoUsageGrant): Promise<UsageSummary> {
  const now = Date.now();
  const dailySince = new Date(Math.max(grant.usageResetAt.getTime(), now - DAY_MS));
  const hourlySince = new Date(Math.max(grant.usageResetAt.getTime(), now - HOUR_MS));
  const [total, daily, hourly] = await Promise.all([
    countSince(grant.id, grant.usageResetAt), countSince(grant.id, dailySince), countSince(grant.id, hourlySince),
  ]);
  return {
    requestsUsed: total.requests, requestLimit: grant.requestLimit,
    dailyUsed: daily.requests, dailyLimit: grant.dailyRequestLimit,
    hourlyUsed: hourly.requests, hourlyLimit: grant.hourlyRequestLimit,
    screenshotsUsed: total.screenshots, screenshotLimit: grant.screenshotLimit,
    maxScreenshotsPerMessage: grant.maxScreenshotsPerMessage,
    startsAt: grant.startsAt, expiresAt: grant.expiresAt, revokedAt: grant.revokedAt,
  };
}

// Lazily provisioned the first time an already-entitled learner opens this
// assistant for this resource — works regardless of whether the profile
// was assigned before or after the learner gained access (enrollment,
// purchase, or AccessGrant), since nothing about entitlement itself
// depends on this row existing. Idempotent: re-fetches an existing grant
// rather than resetting it.
export async function getOrCreateUsageGrant(profile: IakoAssistantProfile, userId: string, resourceType: IakoGrantResource, resourceId: string): Promise<IakoUsageGrant> {
  const existing = await prisma.iakoUsageGrant.findUnique({
    where: { profileId_userId_resourceType_resourceId: { profileId: profile.id, userId, resourceType, resourceId } },
  });
  if (existing) return existing;
  const expiresAt = profile.defaultAccessDays != null ? new Date(Date.now() + profile.defaultAccessDays * DAY_MS) : null;
  return prisma.iakoUsageGrant.create({
    data: {
      profileId: profile.id, userId, resourceType, resourceId, createdById: userId,
      requestLimit: profile.defaultRequestLimit, dailyRequestLimit: profile.defaultDailyRequestLimit,
      hourlyRequestLimit: profile.defaultHourlyRequestLimit, screenshotLimit: profile.defaultScreenshotLimit,
      maxScreenshotsPerMessage: profile.defaultMaxScreenshotsPerMessage, expiresAt,
    },
  });
}

// The actual server-side enforcement point — called BEFORE any AI
// processing (including the scope classifier itself), so a learner who is
// out of requests sees a clear limit message with zero further provider
// spend, matching "no generic AI fallback after the limit."
export async function checkUsageQuota(grant: IakoUsageGrant, incomingScreenshotCount: number): Promise<UsageSummary> {
  const now = new Date();
  if (grant.revokedAt) throw new IakoUsageError(403, 'This IAKO access has been revoked.', 'revoked');
  if (grant.startsAt && grant.startsAt > now) throw new IakoUsageError(403, 'This IAKO access has not started yet.', 'not_started');
  if (grant.expiresAt && grant.expiresAt < now) throw new IakoUsageError(403, 'This IAKO access has expired.', 'expired');
  if (incomingScreenshotCount > grant.maxScreenshotsPerMessage) {
    throw new IakoUsageError(400, `You can attach at most ${grant.maxScreenshotsPerMessage} screenshot(s) per message.`, 'too_many_screenshots');
  }
  const summary = await usageSummary(grant);
  if (summary.requestLimit != null && summary.requestsUsed >= summary.requestLimit) throw new IakoUsageError(429, 'Your IAKO request limit for this access has been reached.', 'request_limit');
  if (summary.dailyLimit != null && summary.dailyUsed >= summary.dailyLimit) throw new IakoUsageError(429, 'Your daily IAKO request limit has been reached. Try again tomorrow.', 'daily_limit');
  if (summary.hourlyLimit != null && summary.hourlyUsed >= summary.hourlyLimit) throw new IakoUsageError(429, 'Too many IAKO requests this hour. Please wait a bit and try again.', 'hourly_limit');
  if (summary.screenshotLimit != null && summary.screenshotsUsed + incomingScreenshotCount > summary.screenshotLimit) {
    throw new IakoUsageError(400, 'Your screenshot limit for this access has been reached.', 'screenshot_limit');
  }
  return summary;
}

// Looks up a prior successful response for this exact idempotency key —
// called before any processing, so a network retry of an already-answered
// request replays the cached reply instead of calling the AI (or billing)
// a second time.
export async function findIdempotentResult(usageGrantId: string, idempotencyKey: string) {
  const log = await prisma.iakoRequestLog.findUnique({ where: { usageGrantId_idempotencyKey: { usageGrantId, idempotencyKey } } });
  if (!log?.resultMessageId) return null;
  const message = await prisma.iakoMessage.findUnique({ where: { id: log.resultMessageId } });
  return message ? { message, log } : null;
}

// The ONLY place a credit is actually consumed — called once a real
// assistant reply exists. Upsert (not create) so a retried request whose
// first attempt crashed AFTER quota-passing but BEFORE this call still
// resolves to exactly one charge, keyed by idempotencyKey.
export async function recordSuccessfulRequest(usageGrantId: string, idempotencyKey: string, screenshotCount: number, resultMessageId: string): Promise<void> {
  await prisma.iakoRequestLog.upsert({
    where: { usageGrantId_idempotencyKey: { usageGrantId, idempotencyKey } },
    create: { usageGrantId, idempotencyKey, screenshotCount, resultMessageId },
    update: { resultMessageId, screenshotCount },
  });
}

export class IakoGrantAdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function adminUpdateUsageGrant(id: string, patch: {
  requestLimit?: number | null; dailyRequestLimit?: number | null; hourlyRequestLimit?: number | null;
  screenshotLimit?: number | null; maxScreenshotsPerMessage?: number; expiresAt?: Date | null; startsAt?: Date | null;
}): Promise<IakoUsageGrant> {
  const existing = await prisma.iakoUsageGrant.findUnique({ where: { id } });
  if (!existing) throw new IakoGrantAdminError(404, 'Usage grant not found.');
  return prisma.iakoUsageGrant.update({ where: { id }, data: patch });
}

export async function adminAddRequests(id: string, amount: number): Promise<IakoUsageGrant> {
  const grant = await prisma.iakoUsageGrant.findUnique({ where: { id } });
  if (!grant) throw new IakoGrantAdminError(404, 'Usage grant not found.');
  if (grant.requestLimit == null) return grant; // Already unlimited — nothing to add to.
  return prisma.iakoUsageGrant.update({ where: { id }, data: { requestLimit: grant.requestLimit + amount } });
}

export async function adminRevokeUsageGrant(id: string): Promise<IakoUsageGrant> {
  const grant = await prisma.iakoUsageGrant.findUnique({ where: { id } });
  if (!grant) throw new IakoGrantAdminError(404, 'Usage grant not found.');
  return prisma.iakoUsageGrant.update({ where: { id }, data: { revokedAt: new Date() } });
}
export async function adminReactivateUsageGrant(id: string): Promise<IakoUsageGrant> {
  const grant = await prisma.iakoUsageGrant.findUnique({ where: { id } });
  if (!grant) throw new IakoGrantAdminError(404, 'Usage grant not found.');
  return prisma.iakoUsageGrant.update({ where: { id }, data: { revokedAt: null } });
}
export async function adminResetUsage(id: string): Promise<IakoUsageGrant> {
  const grant = await prisma.iakoUsageGrant.findUnique({ where: { id } });
  if (!grant) throw new IakoGrantAdminError(404, 'Usage grant not found.');
  return prisma.iakoUsageGrant.update({ where: { id }, data: { usageResetAt: new Date() } });
}
