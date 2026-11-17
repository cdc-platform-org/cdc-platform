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
  designAccessSource: 'SUBSCRIPTION' | 'ACTIVE_COURSE' | 'ADMIN' | 'NONE';
  designAccessExpiresAt: string | null;
  hasCodeStudioAccess: boolean;
  codeAccessSource: 'SUBSCRIPTION' | 'ACTIVE_COURSE' | 'ADMIN' | 'NONE';
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

  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { role: true, adminRole: true, email: true },
  });
  const [enrollments, liveEnrollments, subscriptions] = await Promise.all([
    prisma.courseEnrollment.findMany({
      where: { userId },
      include: { course: { select: { id: true, category: true, title: true } } },
      orderBy: { grantedAt: 'desc' },
    }),
    prisma.liveTrainingEnrollment.findMany({
      where: { userId, status: 'ACTIVE' }, select: { liveTrainingId: true }, take: 1,
    }),
    prisma.accessGrant.findMany({
      where: {
        resourceType: 'DIGITAL_TOOL', resourceId: { in: ['design-studio', 'code-studio'] },
        revokedAt: null,
        OR: [{ userId }, ...(user?.email ? [{ email: user.email.toLowerCase() }] : [])],
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      orderBy: { expiresAt: 'desc' },
    }),
  ]);

  let hasDesignStudioAccess = false;
  let designAccessSource: StudioAccessStatus['designAccessSource'] = 'NONE';
  let designAccessExpiresAt: string | null = null;

  let hasCodeStudioAccess = false;
  let codeAccessSource: StudioAccessStatus['codeAccessSource'] = 'NONE';
  let codeAccessExpiresAt: string | null = null;

  // Paid subscriptions and explicit grants share the existing AccessGrant model.
  for (const sub of subscriptions) {
    const exp = sub.expiresAt?.toISOString() ?? null;
    if (sub.resourceId === 'design-studio' && !hasDesignStudioAccess) {
      hasDesignStudioAccess = true;
      designAccessSource = 'SUBSCRIPTION';
      designAccessExpiresAt = exp;
    }
    if (sub.resourceId === 'code-studio' && !hasCodeStudioAccess) {
      hasCodeStudioAccess = true;
      codeAccessSource = 'SUBSCRIPTION';
      codeAccessExpiresAt = exp;
    }
  }

  // 2. Check active course enrollments within their active duration window
  for (const enr of enrollments) {
    const expiresAt = new Date(enr.grantedAt.getTime() + DEFAULT_COURSE_ACCESS_DAYS * 86_400_000);
    if (enr.grantedAt > now || expiresAt <= now) continue;

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

  if (user?.adminRole || user?.role === 'SuperAdmin') {
    hasDesignStudioAccess = hasCodeStudioAccess = true;
    designAccessSource = codeAccessSource = 'ADMIN';
    designAccessExpiresAt = codeAccessExpiresAt = null;
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