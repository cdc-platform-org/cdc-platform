import { IakoAssistantProfile, IakoGrantResource, IakoUsageGrant, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
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

async function countSince(usageGrantId: string, since: Date, client: Prisma.TransactionClient = prisma): Promise<{ requests: number; screenshots: number }> {
  const logs = await client.iakoRequestLog.aggregate({ where: { usageGrantId, counted: true, createdAt: { gte: since } }, _count: true, _sum: { screenshotCount: true } });
  return { requests: logs._count, screenshots: logs._sum.screenshotCount ?? 0 };
}

// The count a limit is measured against always starts at usageResetAt (an
// admin's "reset usage" moves this forward instead of deleting log rows —
// see the grant's own schema comment) — daily/hourly are additionally
// windowed to the last 24h/1h, whichever is the tighter (later) bound.
export async function usageSummary(grant: IakoUsageGrant, client: Prisma.TransactionClient = prisma): Promise<UsageSummary> {
  const now = Date.now();
  const dailySince = new Date(Math.max(grant.usageResetAt.getTime(), now - DAY_MS));
  const hourlySince = new Date(Math.max(grant.usageResetAt.getTime(), now - HOUR_MS));
  const [total, daily, hourly] = await Promise.all([
    countSince(grant.id, grant.usageResetAt, client), countSince(grant.id, dailySince, client), countSince(grant.id, hourlySince, client),
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
  const expiresAt = profile.defaultAccessDays != null ? new Date(Date.now() + profile.defaultAccessDays * DAY_MS) : null;
  return prisma.iakoUsageGrant.upsert({
    where: { profileId_userId_resourceType_resourceId: { profileId: profile.id, userId, resourceType, resourceId } },
    update: {},
    create: {
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
export function assertUsageAccess(grant: IakoUsageGrant): void {
  const now = new Date();
  if (grant.revokedAt) throw new IakoUsageError(403, 'This IAKO access has been revoked.', 'revoked');
  if (grant.startsAt && grant.startsAt > now) throw new IakoUsageError(403, 'This IAKO access has not started yet.', 'not_started');
  if (grant.expiresAt && grant.expiresAt <= now) throw new IakoUsageError(403, 'This IAKO access has expired.', 'expired');
}

export async function checkUsageQuota(grant: IakoUsageGrant, incomingScreenshotCount: number, client: Prisma.TransactionClient = prisma): Promise<UsageSummary> {
  assertUsageAccess(grant);
  if (incomingScreenshotCount > grant.maxScreenshotsPerMessage) {
    throw new IakoUsageError(400, `You can attach at most ${grant.maxScreenshotsPerMessage} screenshot(s) per message.`, 'too_many_screenshots');
  }
  const summary = await usageSummary(grant, client);
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
export async function findIdempotentResult(usageGrantId: string, idempotencyKey: string, requestHash: string) {
  const log = await prisma.iakoRequestLog.findUnique({ where: { usageGrantId_idempotencyKey: { usageGrantId, idempotencyKey } } });
  if (!log) return null;
  if (log.requestHash && log.requestHash !== requestHash) throw new IakoGrantAdminError(409, 'This idempotency key was already used for a different message.');
  if (!log.resultMessageId) return null;
  const message = await prisma.iakoMessage.findUnique({ where: { id: log.resultMessageId } });
  return message ? { message, log } : null;
}

// The ONLY place a credit is actually consumed — called once a real
// assistant reply exists. Upsert (not create) so a retried request whose
// first attempt crashed AFTER quota-passing but BEFORE this call still
// resolves to exactly one charge, keyed by idempotencyKey.
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export async function acquireUsageLease(usageGrantId: string) {
  const token = randomUUID();
  const claimed = await prisma.iakoUsageGrant.updateMany({
    where: { id: usageGrantId, OR: [{ processingToken: null }, { processingExpiresAt: { lte: new Date() } }] },
    data: { processingToken: token, processingExpiresAt: new Date(Date.now() + PROCESSING_LEASE_MS) },
  });
  if (!claimed.count) throw new IakoGrantAdminError(409, 'An IAKO reply is already being prepared. Please retry after it finishes.');
  let lost = false;
  const heartbeat = setInterval(() => {
    prisma.iakoUsageGrant.updateMany({
      where: { id: usageGrantId, processingToken: token, processingExpiresAt: { gt: new Date() } },
      data: { processingExpiresAt: new Date(Date.now() + PROCESSING_LEASE_MS) },
    }).then((result) => { if (!result.count) lost = true; }).catch(() => { lost = true; });
  }, 60_000);
  heartbeat.unref();
  return {
    token,
    assertHeld: () => { if (lost) throw new IakoGrantAdminError(409, 'This IAKO request expired. Please retry.'); },
    release: async () => {
      clearInterval(heartbeat);
      await prisma.iakoUsageGrant.updateMany({ where: { id: usageGrantId, processingToken: token }, data: { processingToken: null, processingExpiresAt: null } });
    },
  };
}

// Reply and successful usage commit together. A lease lost during network
// processing, or an admin revocation/limit reduction, cannot publish an
// uncharged answer. No provider or storage request runs in this transaction.
export async function recordSuccessfulRequest(params: {
  usageGrantId: string; processingToken: string; idempotencyKey: string; requestHash: string; screenshotCount: number; conversationId: string; reply: string;
  userMessage: string; imageUrls: string[]; outOfScope?: boolean;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM iako_usage_grants WHERE id = ${params.usageGrantId} FOR UPDATE`;
    const grant = await tx.iakoUsageGrant.findUniqueOrThrow({ where: { id: params.usageGrantId } });
    if (grant.processingToken !== params.processingToken || !grant.processingExpiresAt || grant.processingExpiresAt <= new Date()) {
      throw new IakoGrantAdminError(409, 'This IAKO request expired. Please retry.');
    }
    await checkUsageQuota(grant, params.screenshotCount, tx);
    const userMessageAt = new Date();
    await tx.iakoMessage.create({ data: { conversationId: params.conversationId, role: 'USER', content: params.userMessage, imageUrls: params.imageUrls, createdAt: userMessageAt } });
    const message = await tx.iakoMessage.create({ data: { conversationId: params.conversationId, role: 'ASSISTANT', content: params.reply, createdAt: new Date(userMessageAt.getTime() + 1) } });
    await tx.iakoRequestLog.create({ data: { usageGrantId: grant.id, idempotencyKey: params.idempotencyKey, requestHash: params.requestHash, counted: !params.outOfScope, outOfScope: !!params.outOfScope, screenshotCount: params.outOfScope ? 0 : params.screenshotCount, resultMessageId: message.id } });
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
  const startsAt = patch.startsAt === undefined ? existing.startsAt : patch.startsAt;
  const expiresAt = patch.expiresAt === undefined ? existing.expiresAt : patch.expiresAt;
  if (startsAt && expiresAt && startsAt >= expiresAt) throw new IakoGrantAdminError(400, 'startsAt must be before expiresAt.');
  return prisma.iakoUsageGrant.update({ where: { id }, data: patch });
}

export async function adminAddRequests(id: string, amount: number): Promise<IakoUsageGrant> {
  const grant = await prisma.iakoUsageGrant.findUnique({ where: { id } });
  if (!grant) throw new IakoGrantAdminError(404, 'Usage grant not found.');
  if (grant.requestLimit == null) return grant; // Already unlimited — nothing to add to.
  return prisma.iakoUsageGrant.update({ where: { id }, data: { requestLimit: { increment: amount } } });
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
