/**
 * Fulfilment of the 30-day AI tool purchase (BogPayment purpose
 * AI_TOOL_SUBSCRIPTION) as a time-bounded AccessGrant, plus refunds.
 * Exports: grantAiToolSubscriptionPeriod, completeAiToolSubscriptionPayment,
 * revokeAiToolSubscriptionPayment, hasIncludedAiToolAccess.
 * Checkout: routes/payments/aiToolCheckout.ts. Access: marketplace/digitalToolAccessService.ts.
 */
import { Prisma } from '@prisma/client';
import { hasCourseToolAccess } from '../learning/collegeAiAccessService';
import { hasAccessGrant } from '../account/accessGrantService';
import { prisma } from '../../lib/prisma';
import { AI_TOOL_MONTHLY_PRICE_MINOR, AI_TOOL_SUBSCRIPTION_DAYS, AI_TOOL_PAYMENT_NOTE, isAiSubscriptionTool } from '../../config/aiToolSubscriptions';

/** Appends one 30-day period after any still-running paid period. Call inside a transaction. */
export async function grantAiToolSubscriptionPeriod(tx: Prisma.TransactionClient, userId: string, toolKey: string, paymentId: string) {
  // Serialize renewals per buyer, including two different paid orders arriving together.
  await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
  const now = new Date();
  const previous = await tx.accessGrant.findFirst({ where: { userId, resourceType: 'DIGITAL_TOOL', resourceId: toolKey, revokedAt: null, note: { startsWith: AI_TOOL_PAYMENT_NOTE }, expiresAt: { gt: now } }, orderBy: { expiresAt: 'desc' } });
  const startsAt = previous?.expiresAt || now;
  const expiresAt = new Date(startsAt.getTime() + AI_TOOL_SUBSCRIPTION_DAYS * 86400000);
  await tx.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: toolKey, userId, startsAt, expiresAt, note: `${AI_TOOL_PAYMENT_NOTE}${paymentId}`, createdById: userId } });
}

/** Reuses time-bounded AccessGrant rows. No paid flag survives an expired period. */
export async function completeAiToolSubscriptionPayment(paymentId: string, rawCallback: unknown): Promise<boolean> {
  return prisma.$transaction(async tx => {
    const payment = await tx.bogPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.purpose !== 'AI_TOOL_SUBSCRIPTION') return false;
    // A promo or gift card may lower the charge, never raise it: anything
    // above the list price (or a foreign currency) is not ours.
    if (!isAiSubscriptionTool(payment.referenceId) || payment.amount < 0 || payment.amount > AI_TOOL_MONTHLY_PRICE_MINOR || payment.currency !== 'GEL') throw new Error('Invalid AI tool subscription payment.');
    const claimed = await tx.bogPayment.updateMany({ where: { id: paymentId, status: 'PENDING' }, data: { status: 'COMPLETED', completedAt: new Date(), rawCallback: rawCallback as Prisma.InputJsonValue } });
    if (!claimed.count) return true;
    await grantAiToolSubscriptionPeriod(tx, payment.userId, payment.referenceId, payment.id);
    return true;
  });
}

export async function revokeAiToolSubscriptionPayment(tx: Prisma.TransactionClient, paymentId: string) {
  const result = await tx.accessGrant.updateMany({ where: { note: `${AI_TOOL_PAYMENT_NOTE}${paymentId}`, revokedAt: null }, data: { revokedAt: new Date() } });
  return { revoked: result.count > 0, note: 'The refunded AI tool subscription period was revoked.' };
}

/**
 * "Use without paying per item": admin, a course that includes this tool, or
 * any active grant (30-day purchase or admin grant). Trials are NOT included
 * here — callers meter them separately so the trial cap applies.
 */
export async function hasIncludedAiToolAccess(userId: string, key: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, adminRole: true } });
  if (!user) return false;
  return !!user.adminRole || user.role === 'SuperAdmin' || await hasCourseToolAccess(userId, key) || await hasAccessGrant('DIGITAL_TOOL', key, { userId });
}
