import { prisma } from '../lib/prisma';

// ============================================================
// Digital Store creator payout — mirrors escrowService.ts's gig-commission
// pattern (compute platform commission + net share, atomically credit
// earningsBalance, write an immutable WalletEntry) for product sales. Kept
// as its own constant rather than importing escrow's rate — these are two
// independent revenue streams that happen to share a value today, not the
// same policy, and shouldn't be coupled.
// ============================================================

const PLATFORM_COMMISSION_RATE = 0.1; // CDC keeps 10%, creator gets 90%

export interface ProductSaleResult {
  paymentStatus: string;
  commissionRate: number | null;
  commissionAmount: number | null;
  netAmount: number | null;
}

// Completes a product purchase and, when the product has a real external
// creator (DigitalProduct.submittedById — admin-catalog products have none
// and keep the full amount with the platform, same as a course sale),
// credits that creator's earningsBalance with their 90% net share.
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
      select: { submittedById: true },
    });

    let commissionRate: number | null = null;
    let commissionAmount: number | null = null;
    let netAmount: number | null = null;

    if (product?.submittedById) {
      commissionRate = PLATFORM_COMMISSION_RATE;
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
      },
      create: {
        userId: params.userId,
        productId: params.productId,
        amount: params.amount,
        paymentStatus: 'COMPLETED',
        commissionRate,
        commissionAmount,
        netAmount,
      },
    });

    return {
      paymentStatus: purchase.paymentStatus,
      commissionRate: purchase.commissionRate,
      commissionAmount: purchase.commissionAmount,
      netAmount: purchase.netAmount,
    };
  });
}
