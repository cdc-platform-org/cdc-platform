/**
 * Coloring-page credits: balance, the free trial page, reserving/refunding a
 * credit around one generation, and fulfilling a paid pack.
 * Exports: getColoringAccount, reserveCredit, refundCredit, NoColoringCreditsError,
 * completeColoringCreditPurchase, failColoringCreditPurchase.
 *
 * A credit is RESERVED before the (paid) image call and REFUNDED if the page
 * ends up blocked or failed — so users only pay for pages they receive, and
 * two parallel requests can never spend the same credit.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class NoColoringCreditsError extends Error {
  constructor() {
    super('No coloring-page credits left.');
    this.name = 'NoColoringCreditsError';
  }
}

export type CreditSource = 'FREE' | 'CREDIT';

export async function getColoringAccount(userId: string) {
  return prisma.coloringAccount.upsert({ where: { userId }, update: {}, create: { userId } });
}

// Uses the free trial page first, then a paid credit. Both are conditional
// updates, so a concurrent request that loses the race gets count 0.
export async function reserveCredit(tx: Prisma.TransactionClient, userId: string): Promise<CreditSource> {
  await tx.coloringAccount.upsert({ where: { userId }, update: {}, create: { userId } });
  const free = await tx.coloringAccount.updateMany({ where: { userId, freeUsed: false }, data: { freeUsed: true } });
  if (free.count === 1) return 'FREE';
  const paid = await tx.coloringAccount.updateMany({ where: { userId, balance: { gt: 0 } }, data: { balance: { decrement: 1 } } });
  if (paid.count === 1) return 'CREDIT';
  throw new NoColoringCreditsError();
}

export async function refundCredit(userId: string, source: CreditSource): Promise<void> {
  if (source === 'FREE') {
    await prisma.coloringAccount.update({ where: { userId }, data: { freeUsed: false } });
  } else {
    await prisma.coloringAccount.update({ where: { userId }, data: { balance: { increment: 1 } } });
  }
}

// Called from the BOG callback (and a 0-amount path if ever added).
// Idempotent: only the PENDING -> COMPLETED winner adds the credits.
export async function completeColoringCreditPurchase(purchaseId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.coloringCreditPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return false;
    const claimed = await tx.coloringCreditPurchase.updateMany({
      where: { id: purchaseId, status: 'PENDING' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    await tx.coloringAccount.upsert({
      where: { userId: purchase.userId },
      update: { balance: { increment: purchase.credits } },
      create: { userId: purchase.userId, balance: purchase.credits },
    });
    return true;
  });
}

export async function failColoringCreditPurchase(purchaseId: string): Promise<void> {
  await prisma.coloringCreditPurchase.updateMany({ where: { id: purchaseId, status: 'PENDING' }, data: { status: 'FAILED' } });
}
