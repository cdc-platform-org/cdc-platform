/**
 * @fileoverview Conditional Workspace & Studio Access Control Service.
 * Determines whether a student has active access to the 2-in-1 Design Studio (Ps/Ai)
 * or the SQL & Frontend Code Studio based on:
 *   1. An active standalone monthly tool subscription (29 GEL/month), OR
 *   2. A paid, unfinished CourseEnrollment whose course lists the studio in
 *      Course.aiToolKeys (see services/learning/collegeAiAccessService.ts).
 * The unified 3-day trial is layered on top in digitalToolAccessService.ts.
 */

import { prisma } from '../lib/prisma';
import { getCollegeAiAccessStatus } from './learning/collegeAiAccessService';

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

export async function resolveStudentWorkspaceAccess(userId: string): Promise<StudioAccessStatus> {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { role: true, adminRole: true, email: true },
  });
  const [designCourse, codeCourse, liveEnrollments, subscriptions] = await Promise.all([
    getCollegeAiAccessStatus(userId, 'design-studio', now),
    getCollegeAiAccessStatus(userId, 'code-studio', now),
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

  // 2. A paid, unfinished course that lists the studio unlocks it — same
  // rule as every other AI tool (collegeAiAccessService), so access ends
  // automatically when the course is finished or the window lapses.
  if (designCourse.active && designCourse.endsAt && !hasDesignStudioAccess) {
    hasDesignStudioAccess = true; designAccessSource = 'ACTIVE_COURSE'; designAccessExpiresAt = designCourse.endsAt.toISOString();
  }
  if (codeCourse.active && codeCourse.endsAt && !hasCodeStudioAccess) {
    hasCodeStudioAccess = true; codeAccessSource = 'ACTIVE_COURSE'; codeAccessExpiresAt = codeCourse.endsAt.toISOString();
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