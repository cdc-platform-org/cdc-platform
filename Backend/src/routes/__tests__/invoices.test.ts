import { prisma } from '../../lib/prisma';
import { describePurchase } from '../invoices';
import { createUser, createCourse, createDigitalProduct } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

// Regression coverage for the Stripe-invoice 404 fix: invoices.ts now falls
// back to StripePayment when a payment id isn't a BogPayment, but must never
// print a platformFee/netAmount breakdown for that path — those stored
// values (ProductPurchase.commissionAmount/netAmount) are computed from
// amountGel (GEL tetri), while a Stripe invoice's totalAmount/currency is in
// USD/EUR. Mixing them on one line would misrepresent the split.
describe('invoices — describePurchase', () => {
  it('COURSE: never returns a fee breakdown regardless of the includeCommissionBreakdown flag (courses have no split)', async () => {
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id });

    const bogStyle = await describePurchase('COURSE', course.id, buyer.id, true);
    const stripeStyle = await describePurchase('COURSE', course.id, buyer.id, false);
    expect(bogStyle.description).toContain(course.title);
    expect(bogStyle.platformFee).toBeNull();
    expect(stripeStyle.platformFee).toBeNull();
  });

  it('PRODUCT via BOG (includeCommissionBreakdown=true): returns the real commission split', async () => {
    const buyer = await createUser();
    const creator = await createUser({ isVerifiedGraduate: true });
    const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });
    await prisma.productPurchase.create({
      data: { userId: buyer.id, productId: product.id, amount: 10000, paymentStatus: 'COMPLETED', commissionAmount: 2000, netAmount: 8000 },
    });

    const result = await describePurchase('PRODUCT', product.id, buyer.id, true);
    expect(result.description).toContain(product.title);
    expect(result.platformFee).toBe(2000);
    expect(result.netAmount).toBe(8000);
  });

  it('PRODUCT via Stripe (includeCommissionBreakdown=false): suppresses the fee breakdown even though a real split exists in the DB', async () => {
    const buyer = await createUser();
    const creator = await createUser({ isVerifiedGraduate: true });
    const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });
    await prisma.productPurchase.create({
      data: { userId: buyer.id, productId: product.id, amount: 10000, paymentStatus: 'COMPLETED', commissionAmount: 2000, netAmount: 8000 },
    });

    const result = await describePurchase('PRODUCT', product.id, buyer.id, false);
    expect(result.description).toContain(product.title);
    expect(result.platformFee).toBeNull();
    expect(result.netAmount).toBeNull();
  });
});
