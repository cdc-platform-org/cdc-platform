import { prisma } from '../lib/prisma';
import { getCommissionRate } from './platformFeeScheduleService';

// ============================================================
// Digital Store creator payout — mirrors escrowService.ts's gig-commission
// pattern (compute platform commission + net share, atomically credit
// earningsBalance, write an immutable WalletEntry) for product sales.
//
// Rate (20% by default: 10% bank/payment-gateway (BOG) processing fee + 10%
// CDC Center platform support fee) is read from PlatformFeeSchedule's
// DIGITAL_PRODUCT row (platformFeeScheduleService.ts), admin-editable at
// /admin/commissions — independent from the other 3 revenue streams' rows.
// NOTE: legalContent.ts's Terms & Conditions "Digital Store — Revenue
// Split" clause and the upload form's commission banner still quote a
// static 20% and are NOT wired to this table — they'll drift if an admin
// changes this rate, same known gap as everywhere else static legal copy
// quotes a number that's now admin-editable.
// ============================================================

export interface ProductSaleResult {
  paymentStatus: string;
  commissionRate: number | null;
  commissionAmount: number | null;
  netAmount: number | null;
}

// Completes a product purchase and, when the product has a real external
// creator (DigitalProduct.submittedById — admin-catalog products have none
// and keep the full amount with the platform, same as a course sale),
// credits that creator's earningsBalance with their 80% net share.
//
// Safe to call more than once for the same (userId, productId) pair — a BOG
// webhook retry and the /bog/status status-poll fallback can both route
// through here for the same purchase. The creator is only ever credited the
// first time a purchase is completed; a re-run against an already-COMPLETED
// purchase is a no-op that just returns the stored split.
export async function completeProductPurchase(params: {
  userId: string;
  productId: string;
  amount: number;
}): Promise<ProductSaleResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.productPurchase.findUnique({
      where: { userId_productId: { userId: params.userId, productId: params.productId } },
    });
    if (existing?.paymentStatus === 'COMPLETED') {
      return {
        paymentStatus: existing.paymentStatus,
        commissionRate: existing.commissionRate,
        commissionAmount: existing.commissionAmount,
        netAmount: existing.netAmount,
      };
    }

    const product = await tx.digitalProduct.findUnique({
      where: { id: params.productId },
      select: { submittedById: true, licenseType: true },
    });

    let commissionRate: number | null = null;
    let commissionAmount: number | null = null;
    let netAmount: number | null = null;

    if (product?.submittedById) {
      commissionRate = await getCommissionRate('DIGITAL_PRODUCT');
      commissionAmount = Math.round(params.amount * commissionRate);
      netAmount = params.amount - commissionAmount;

      const creator = await tx.user.update({
        where: { id: product.submittedById },
        data: { earningsBalance: { increment: netAmount } },
      });
      await tx.walletEntry.create({
        data: {
          userId: creator.id,
          type: 'PRODUCT_SALE_CREDIT',
          amount: netAmount,
          balanceAfter: creator.earningsBalance,
        },
      });
    }

    const purchase = await tx.productPurchase.upsert({
      where: { userId_productId: { userId: params.userId, productId: params.productId } },
      update: {
        paymentStatus: 'COMPLETED',
        amount: params.amount,
        commissionRate,
        commissionAmount,
        netAmount,
        licenseType: product?.licenseType,
      },
      create: {
        userId: params.userId,
        productId: params.productId,
        amount: params.amount,
        paymentStatus: 'COMPLETED',
        commissionRate,
        commissionAmount,
        netAmount,
        licenseType: product?.licenseType,
      },
    });

    // Reached only on a genuine new completion — the early-return above
    // already caught a retry of an already-COMPLETED purchase, so this
    // never double-counts a webhook retry or the /bog/status poll fallback.
    await tx.digitalProduct.update({ where: { id: params.productId }, data: { salesCount: { increment: 1 } } });

    return {
      paymentStatus: purchase.paymentStatus,
      commissionRate: purchase.commissionRate,
      commissionAmount: purchase.commissionAmount,
      netAmount: purchase.netAmount,
    };
  });
}
