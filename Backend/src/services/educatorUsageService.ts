import { prisma } from '../lib/prisma';
import { EducatorGenerationType } from '@prisma/client';

// Monthly fair-use quotas for the AI Educator VIP Hub — same rolling-window
// row-count pattern as englishTutorQuotaService.ts's daily cap (counts
// EducatorGeneration rows created in the last 30 days rather than a
// resettable counter, so it needs no cron/reset job and stays correct
// across multiple server instances). TEST_GENERATOR + RUBRIC share the
// "generations" budget; GRADING has its own separate, smaller budget — see
// EducatorGeneration.type's own schema comment.
export const EDUCATOR_MONTHLY_GENERATION_LIMIT = 300;
export const EDUCATOR_MONTHLY_GRADING_LIMIT = 50;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface EducatorUsageStatus {
  generationsUsed: number;
  generationsLimit: number;
  gradingsUsed: number;
  gradingsLimit: number;
}

export async function getEducatorUsage(userId: string): Promise<EducatorUsageStatus> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [generationsUsed, gradingsUsed] = await Promise.all([
    prisma.educatorGeneration.count({ where: { userId, type: { in: ['TEST_GENERATOR', 'RUBRIC'] }, createdAt: { gte: since } } }),
    prisma.educatorGeneration.count({ where: { userId, type: 'GRADING', createdAt: { gte: since } } }),
  ]);
  return {
    generationsUsed,
    generationsLimit: EDUCATOR_MONTHLY_GENERATION_LIMIT,
    gradingsUsed,
    gradingsLimit: EDUCATOR_MONTHLY_GRADING_LIMIT,
  };
}

// SuperAdmin bypasses both quotas entirely (QA/support, same posture as
// hasEducatorVipAccess) — callers check this before hasReached*Limit below.
export async function hasReachedGenerationLimit(userId: string): Promise<boolean> {
  const { generationsUsed, generationsLimit } = await getEducatorUsage(userId);
  return generationsUsed >= generationsLimit;
}

export async function hasReachedGradingLimit(userId: string): Promise<boolean> {
  const { gradingsUsed, gradingsLimit } = await getEducatorUsage(userId);
  return gradingsUsed >= gradingsLimit;
}

export async function recordEducatorGeneration(userId: string, type: EducatorGenerationType): Promise<void> {
  await prisma.educatorGeneration.create({ data: { userId, type } });
}
