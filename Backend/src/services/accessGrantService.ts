import { IakoGrantResource } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class AccessGrantError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// A grant is active when: not revoked, the window (if set) covers `now`,
// and it targets either this exact userId or this user's email (lets an
// admin grant access to someone before they've even registered — see
// AccessGrant.email's own schema comment). Called ALONGSIDE a resource's
// own natural entitlement check, never as a replacement for it — see
// services/digitalToolAccessService.ts and trainingGuideService.ts's own
// enrollment check for the two current callers.
export async function hasAccessGrant(
  resourceType: IakoGrantResource, resourceId: string, identity: { userId?: string; email?: string | null }
): Promise<boolean> {
  if (!identity.userId && !identity.email) return false;
  const now = new Date();
  const grant = await prisma.accessGrant.findFirst({
    where: {
      resourceType, resourceId, revokedAt: null,
      OR: [
        ...(identity.userId ? [{ userId: identity.userId }] : []),
        ...(identity.email ? [{ email: identity.email.toLowerCase() }] : []),
      ],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    select: { id: true },
  });
  return !!grant;
}

export async function listAccessGrants(resourceType?: IakoGrantResource, resourceId?: string) {
  return prisma.accessGrant.findMany({
    where: { ...(resourceType ? { resourceType } : {}), ...(resourceId ? { resourceId } : {}) },
    include: { user: { select: { id: true, name: true, email: true } }, createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAccessGrant(input: {
  resourceType: IakoGrantResource; resourceId: string; userId?: string | null; email?: string | null;
  startsAt?: Date | null; expiresAt?: Date | null; note?: string | null; createdById: string;
}) {
  if (!input.userId && !input.email) throw new AccessGrantError(400, 'A grant needs either a userId or an email.');
  if (input.startsAt && input.expiresAt && input.startsAt >= input.expiresAt) {
    throw new AccessGrantError(400, 'startsAt must be before expiresAt.');
  }
  return prisma.accessGrant.create({
    data: {
      resourceType: input.resourceType, resourceId: input.resourceId,
      userId: input.userId || null, email: input.email ? input.email.toLowerCase() : null,
      startsAt: input.startsAt ?? null, expiresAt: input.expiresAt ?? null, note: input.note ?? null,
      createdById: input.createdById,
    },
  });
}

export async function revokeAccessGrant(id: string) {
  const grant = await prisma.accessGrant.findUnique({ where: { id } });
  if (!grant) throw new AccessGrantError(404, 'Grant not found.');
  if (grant.revokedAt) return grant;
  return prisma.accessGrant.update({ where: { id }, data: { revokedAt: new Date() } });
}
