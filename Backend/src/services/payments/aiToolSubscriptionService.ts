import { Prisma } from '@prisma/client';
import { hasActiveCollegeAiAccess } from '../learning/collegeAiAccessService';
import { hasAccessGrant } from '../account/accessGrantService';
import { prisma } from '../../lib/prisma';
import { AI_TOOL_MONTHLY_PRICE_MINOR, AI_TOOL_SUBSCRIPTION_DAYS, AI_TOOL_PAYMENT_NOTE, isAiSubscriptionTool } from '../../config/aiToolSubscriptions';

/** Reuses time-bounded AccessGrant rows. No paid flag survives an expired period. */
export async function completeAiToolSubscriptionPayment(paymentId: string, rawCallback: unknown): Promise<boolean> {
  return prisma.$transaction(async tx => {
    const payment = await tx.bogPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.purpose !== 'AI_TOOL_SUBSCRIPTION') return false;
    if (!isAiSubscriptionTool(payment.referenceId) || payment.amount !== AI_TOOL_MONTHLY_PRICE_MINOR || payment.currency !== 'GEL') throw new Error('Invalid AI tool subscription payment.');
    // Serialize renewals per buyer, including two different paid orders arriving together.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${payment.userId} FOR UPDATE`);
    const claimed = await tx.bogPayment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'COMPLETED', completedAt: new Date(), rawCallback: rawCallback as Prisma.InputJsonValue } });
    if (!claimed.count) return true;
    const now = new Date();
    const previous = await tx.accessGrant.findFirst({ where: { userId: payment.userId, resourceType: 'DIGITAL_TOOL', resourceId: payment.referenceId, revokedAt: null, note: { startsWith: AI_TOOL_PAYMENT_NOTE }, expiresAt: { gt: now } }, orderBy: { expiresAt: 'desc' } });
    const startsAt = previous?.expiresAt || now;
    const expiresAt = new Date(startsAt.getTime() + AI_TOOL_SUBSCRIPTION_DAYS * 86400000);
    await tx.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: payment.referenceId, userId: payment.userId, startsAt, expiresAt, note: `${AI_TOOL_PAYMENT_NOTE}${payment.id}`, createdById: payment.userId } });
    return true;
  });
}

export async function revokeAiToolSubscriptionPayment(tx: Prisma.TransactionClient, paymentId: string) {
  const result = await tx.accessGrant.updateMany({ where: { note: `${AI_TOOL_PAYMENT_NOTE}${paymentId}`, revokedAt: null }, data: { revokedAt: new Date() } });
  return { revoked: result.count > 0, note: 'The refunded AI tool subscription period was revoked.' };
}

export async function hasIncludedAiToolAccess(userId: string, key: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true } });
  if (!user) return false;
  return !!user.adminRole || user.role === 'SuperAdmin' || await hasActiveCollegeAiAccess(userId) || await hasAccessGrant('DIGITAL_TOOL', key, { userId });
}
