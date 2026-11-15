/**
 * @fileoverview Conditional Workspace & Studio Access Control Service.
 * Determines whether a student has active access to the 2-in-1 Design Studio (Ps/Ai)
 * or the SQL & Frontend Code Studio based on:
 *   1. An active standalone monthly tool subscription (29 GEL/month), OR
 *   2. An active CourseEnrollment whose access duration window has not expired.
 */

import { prisma } from '../lib/prisma';

export interface StudioAccessStatus {
  hasDesignStudioAccess: boolean;
  designAccessSource: 'SUBSCRIPTION' | 'ACTIVE_COURSE' | 'NONE';
  designAccessExpiresAt: string | null;
  hasCodeStudioAccess: boolean;
  codeAccessSource: 'SUBSCRIPTION' | 'ACTIVE_COURSE' | 'NONE';
  codeAccessExpiresAt: string | null;
  hasActiveLiveTraining: boolean;
  activeLiveTrainingId: string | null;
}

const DEFAULT_COURSE_ACCESS_DAYS = 90;

function isDesignCategory(category: string): boolean {
  return /design|ui|ux|graphic|photoshop|illustrator|დიზაინ/i.test(category);
}

function isCodeCategory(category: string): boolean {
  return /dev|code|sql|web|frontend|backend|data|program|პროგრამ|ბაზ/i.test(category);
}

export async function resolveStudentWorkspaceAccess(userId: string): Promise<StudioAccessStatus> {
  const now = new Date();

  const [enrollments, liveEnrollments, subscriptions] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: { select: { id: true, category: true, title: true } },
      },
      orderBy: { grantedAt: 'desc' },
    }),
    prisma.liveTrainingEnrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { liveTrainingId: true },
      take: 1,
    }),
    // Safe lookup if ToolSubscription model exists in Prisma client
    (prisma as any).toolSubscription?.findMany
      ? (prisma as any).toolSubscription.findMany({
          where: { userId, status: 'ACTIVE', expiresAt: { gt: now } },
        })
      : Promise.resolve([]),
  ]);

  let hasDesignStudioAccess = false;
  let designAccessSource: StudioAccessStatus['designAccessSource'] = 'NONE';
  let designAccessExpiresAt: string | null = null;

  let hasCodeStudioAccess = false;
  let codeAccessSource: StudioAccessStatus['codeAccessSource'] = 'NONE';
  let codeAccessExpiresAt: string | null = null;

  // 1. Check active standalone tool subscriptions (29 GEL/month)
  for (const sub of subscriptions as any[]) {
    const slug = String(sub.toolSlug || sub.slug || '').toLowerCase();
    const exp = sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null;
    if (slug.includes('design') || slug.includes('photoshop') || slug.includes('illustrator')) {
      hasDesignStudioAccess = true;
      designAccessSource = 'SUBSCRIPTION';
      designAccessExpiresAt = exp;
    }
    if (slug.includes('code') || slug.includes('sql')) {
      hasCodeStudioAccess = true;
      codeAccessSource = 'SUBSCRIPTION';
      codeAccessExpiresAt = exp;
    }
  }

  // 2. Check active course enrollments within their active duration window
  for (const enr of enrollments) {
    const expiresAt = new Date(enr.grantedAt.getTime() + DEFAULT_COURSE_ACCESS_DAYS * 86_400_000);
    if (expiresAt <= now) continue;

    if (!hasDesignStudioAccess && isDesignCategory(enr.course.category)) {
      hasDesignStudioAccess = true;
      designAccessSource = 'ACTIVE_COURSE';
      designAccessExpiresAt = expiresAt.toISOString();
    }
    if (!hasCodeStudioAccess && isCodeCategory(enr.course.category)) {
      hasCodeStudioAccess = true;
      codeAccessSource = 'ACTIVE_COURSE';
      codeAccessExpiresAt = expiresAt.toISOString();
    }
  }

  return {
    hasDesignStudioAccess,
    designAccessSource,
    designAccessExpiresAt,
    hasCodeStudioAccess,
    codeAccessSource,
    codeAccessExpiresAt,
    hasActiveLiveTraining: liveEnrollments.length > 0,
    activeLiveTrainingId: liveEnrollments[0]?.liveTrainingId ?? null,
  };
}