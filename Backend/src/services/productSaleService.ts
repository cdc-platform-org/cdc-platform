import { prisma } from '../lib/prisma';
import { getCommissionRate } from './platformFeeScheduleService';
import { isIdentityVerified } from '../utils/freelancerVerification';

// ============================================================
// Digital Store creator payout — mirrors escrowService.ts's gig-commission
// pattern (compute platform commission + net share, atomically credit
// earningsBalance, write an immutable WalletEntry) for product sales.
//
// Rate (20% by default for a verified creator: 10% bank/payment-gateway
// (BOG) processing fee + 10% CDC Center platform support fee; 25% for an
// unverified one — the +5% Unverified Tier Surcharge) is read from
// PlatformFeeSchedule's DIGITAL_PRODUCT_VERIFIED/DIGITAL_PRODUCT_UNVERIFIED
// rows (platformFeeScheduleService.ts), admin-editable at /admin/commissions
// — independent from the other 3 revenue streams' rows.
// NOTE: legalContent.ts's Terms & Conditions "Digital Store — Revenue
// Split" clause and the upload form's commission banner still quote the
// static default percentages and are NOT wired to this table — they'll
// drift if an admin changes either rate, same known gap as everywhere else
// static legal copy quotes a number that's now admin-editable.
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
// through here for the same purchase, often within milliseconds of each
// other. The creator is only ever credited the first time a purchase is
// completed; a re-run against an already-COMPLETED purchase is a no-op that
// just returns the stored split.
//
// Unlike a plain findUnique-then-upsert (the previous implementation), the
// "am I first" check below is itself an atomic DB write — either an
// `updateMany` claim guarded by `paymentStatus: { not: 'COMPLETED' }`, or,
// if no row exists yet, a `createMany({ skipDuplicates: true })` that
// relies on the userId_productId unique constraint to silently drop a
// concurrent duplicate rather than credit it. Under a plain
// findUnique-then-upsert, two concurrent completions could both read
// "not completed yet" before either had written, and both would credit the
// creator — a real double-credit, not just a theoretical one, since the
// webhook and the status poll are expected to race by design.
//
// Deliberately `createMany({ skipDuplicates: true })`, not a plain `create`
// in a try/catch for P2002: a caught error still leaves a Postgres
// transaction in the aborted state (every later statement in the same
// `$transaction` callback fails with "current transaction is aborted"
// regardless of the JS catch), so a `create` that can conflict must never
// be allowed to actually throw inside this transaction. `createMany` with
// `skipDuplicates` compiles to `INSERT ... ON CONFLICT DO NOTHING`, which
// never raises an error in the first place — it just reports a 0-row
// insert, exactly what "someone else already claimed it" needs to look
// like to stay inside one atomic transaction.
export async function completeProductPurchase(params: {
  userId: string;
  productId: string;
  amount: number;
}): Promise<ProductSaleResult> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.digitalProduct.findUnique({
      where: { id: params.productId },
      select: {
        submittedById: true,
        licenseType: true,
        submittedBy: {
          select: { isVerifiedGraduate: true, verificationLevel: true, verificationStatus: true, isVerified: true },
        },
      },
    });

    let commissionRate: number | null = null;
    let commissionAmount: number | null = null;
    let netAmount: number | null = null;
    if (product?.submittedById) {
      // +5% Unverified Tier Surcharge — an unverified creator's sale pays
      // the higher DIGITAL_PRODUCT_UNVERIFIED rate, same verification check
      // (any approved track: individual, graduate, or business) and same
      // "lock the rate at capture time" posture as escrowService.ts's
      // GIG_VERIFIED/GIG_UNVERIFIED split.
      const creatorVerified = !!product.submittedBy && isIdentityVerified(product.submittedBy);
      commissionRate = await getCommissionRate(creatorVerified ? 'DIGITAL_PRODUCT_VERIFIED' : 'DIGITAL_PRODUCT_UNVERIFIED');
      commissionAmount = Math.round(params.amount * commissionRate);
      netAmount = params.amount - commissionAmount;
    }

    const completedData = {
      paymentStatus: 'COMPLETED',
      amount: params.amount,
      commissionRate,
      commissionAmount,
      netAmount,
      licenseType: product?.licenseType,
    };

    let wonClaim: boolean;
    const claimed = await tx.productPurchase.updateMany({
      where: { userId: params.userId, productId: params.productId, paymentStatus: { not: 'COMPLETED' } },
      data: completedData,
    });
    if (claimed.count === 1) {
      wonClaim = true;
    } else {
      const created = await tx.productPurchase.createMany({
        data: [{ userId: params.userId, productId: params.productId, ...completedData }],
        skipDuplicates: true,
      });
      // count === 0 means another concurrent completion (webhook vs.
      // status-poll) already claimed/created this purchase first — back
      // off without crediting.
      wonClaim = created.count === 1;
    }

    if (wonClaim) {
      if (product?.submittedById) {
        const creator = await tx.user.update({
          where: { id: product.submittedById },
          data: { earningsBalance: { increment: netAmount! } },
        });
        await tx.walletEntry.create({
          data: {
            userId: creator.id,
            type: 'PRODUCT_SALE_CREDIT',
            amount: netAmount!,
            balanceAfter: creator.earningsBalance,
          },
        });
      }
      // Reached only on a genuine new completion that actually won the
      // claim above — never double-counts a webhook retry or the
      // /bog/status poll fallback racing this same purchase. Increments for
      // every new completion (admin-catalog products included), matching
      // the original unconditional-after-upsert behavior.
      await tx.digitalProduct.update({ where: { id: params.productId }, data: { salesCount: { increment: 1 } } });
    }

    const purchase = await tx.productPurchase.findUniqueOrThrow({
      where: { userId_productId: { userId: params.userId, productId: params.productId } },
    });

    return {
      paymentStatus: purchase.paymentStatus,
      commissionRate: purchase.commissionRate,
      commissionAmount: purchase.commissionAmount,
      netAmount: purchase.netAmount,
    };
  });
}
