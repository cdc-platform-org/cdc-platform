import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { completeProductPurchase } from '../productSaleService';
import { upsertCommissionPercentage } from '../platformFeeScheduleService';
import { createUser } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

async function createDigitalProduct(params: { submittedById?: string; price?: number }) {
  const suffix = randomUUID();
  return prisma.digitalProduct.create({
    data: {
      title: `Test Product ${suffix.slice(0, 8)}`,
      description: 'A digital product used in tests.',
      price: params.price ?? 10000,
      category: 'UI Kit',
      imageUrl: 'https://example.test/image.png',
      fileUrl: 'https://example.test/file.zip',
      status: 'APPROVED',
      submittedById: params.submittedById,
    },
  });
}

describe('productSaleService', () => {
  describe('completeProductPurchase', () => {
    it('credits the creator their net share exactly once, and is a no-op on a repeat call', async () => {
      await upsertCommissionPercentage('DIGITAL_PRODUCT_VERIFIED', 20, 'test');
      const buyer = await createUser();
      const creator = await createUser({ isVerifiedGraduate: true });
      const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });

      const first = await completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 10000 });
      expect(first.paymentStatus).toBe('COMPLETED');
      expect(first.commissionAmount).toBe(2000);
      expect(first.netAmount).toBe(8000);

      const afterFirst = await prisma.user.findUniqueOrThrow({ where: { id: creator.id } });
      expect(afterFirst.earningsBalance).toBe(8000);

      // A retry (BOG webhook + the /status poll fallback both routing here
      // for the same purchase) must not credit the creator a second time.
      const second = await completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 10000 });
      expect(second.paymentStatus).toBe('COMPLETED');
      expect(second.netAmount).toBe(8000);

      const afterSecond = await prisma.user.findUniqueOrThrow({ where: { id: creator.id } });
      expect(afterSecond.earningsBalance).toBe(8000); // unchanged, not 16000

      const walletEntries = await prisma.walletEntry.findMany({ where: { userId: creator.id, type: 'PRODUCT_SALE_CREDIT' } });
      expect(walletEntries).toHaveLength(1);

      const reloadedProduct = await prisma.digitalProduct.findUniqueOrThrow({ where: { id: product.id } });
      expect(reloadedProduct.salesCount).toBe(1);
    });

    it('atomic claim: two concurrent completions of the same purchase credit the creator exactly once', async () => {
      await upsertCommissionPercentage('DIGITAL_PRODUCT_VERIFIED', 20, 'test');
      const buyer = await createUser();
      const creator = await createUser({ isVerifiedGraduate: true });
      const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });

      // Simulates the BOG webhook and the frontend's /status poll fallback
      // racing each other for the exact same purchase, both completing it
      // at nearly the same time.
      const results = await Promise.all([
        completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 10000 }),
        completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 10000 }),
      ]);
      expect(results[0].netAmount).toBe(8000);
      expect(results[1].netAmount).toBe(8000);

      const creatorAfter = await prisma.user.findUniqueOrThrow({ where: { id: creator.id } });
      expect(creatorAfter.earningsBalance).toBe(8000); // credited once, not 16000

      const walletEntries = await prisma.walletEntry.findMany({ where: { userId: creator.id, type: 'PRODUCT_SALE_CREDIT' } });
      expect(walletEntries).toHaveLength(1);

      const reloadedProduct = await prisma.digitalProduct.findUniqueOrThrow({ where: { id: product.id } });
      expect(reloadedProduct.salesCount).toBe(1); // incremented once, not twice
    });

    it('charges the +5% DIGITAL_PRODUCT_UNVERIFIED rate for a creator with no verification', async () => {
      await upsertCommissionPercentage('DIGITAL_PRODUCT_UNVERIFIED', 25, 'test');
      const buyer = await createUser();
      const creator = await createUser({ isVerifiedGraduate: false, isVerified: false });
      const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });

      const result = await completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 10000 });
      expect(result.commissionRate).toBeCloseTo(0.25);
      expect(result.commissionAmount).toBe(2500);
      expect(result.netAmount).toBe(7500);
    });

    it('charges the lower DIGITAL_PRODUCT_VERIFIED rate for a graduate-verified creator', async () => {
      await upsertCommissionPercentage('DIGITAL_PRODUCT_VERIFIED', 20, 'test');
      const buyer = await createUser();
      const creator = await createUser({ isVerifiedGraduate: true });
      const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });

      const result = await completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 10000 });
      expect(result.commissionRate).toBeCloseTo(0.2);
      expect(result.commissionAmount).toBe(2000);
      expect(result.netAmount).toBe(8000);
    });

    it('admin-catalog products (no submittedById) keep the full amount and credit nobody', async () => {
      const buyer = await createUser();
      const product = await createDigitalProduct({ price: 5000 });

      const result = await completeProductPurchase({ userId: buyer.id, productId: product.id, amount: 5000 });
      expect(result.commissionAmount).toBeNull();
      expect(result.netAmount).toBeNull();

      const reloadedProduct = await prisma.digitalProduct.findUniqueOrThrow({ where: { id: product.id } });
      expect(reloadedProduct.salesCount).toBe(1); // still increments even with no creator to credit
    });
  });
});
