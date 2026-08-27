import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { applyStripePaymentResult } from '../stripePayments';
import { upsertCommissionPercentage } from '../../services/platformFeeScheduleService';
import { createUser, createCourse } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

const fakeSession = { payment_intent: 'pi_test_fake' } as unknown as Stripe.Checkout.Session;

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

// Regression coverage for a real bug: routes/stripePayments.ts used to pass
// StripePayment.amount (post-FX-conversion USD/EUR minor units) straight
// into the commission/payout math, crediting the seller's GEL-denominated
// earningsBalance with a USD/EUR-cents-sized number — under-crediting them
// by roughly the GEL exchange rate on every Stripe-funded sale. The fix
// (StripePayment.amountGel) is what these tests assert on: every
// completion branch must use the real pre-conversion GEL amount, not the
// converted `amount` actually charged in USD/EUR.
describe('applyStripePaymentResult — GEL/USD amount separation', () => {
  it('COURSE: credits the instructor from amountGel, not the USD-converted amount', async () => {
    await upsertCommissionPercentage('COURSE', 20, 'test');
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });

    // Simulates a real USD Stripe checkout: 10000 GEL tetri (100 GEL)
    // converted at the ~0.36 default rate to 3600 USD cents ($36) — the two
    // numbers are deliberately very different so a bug that uses the wrong
    // one is unmistakable in the assertion below.
    const stripePayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `test-${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 3600,
        amountGel: 10000,
        currency: 'USD',
        status: 'PENDING',
      },
    });

    await applyStripePaymentResult(stripePayment.id, fakeSession, {});

    const instructorAfter = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
    // 80% of 10000 (the real GEL price), not 80% of 3600 (the USD cents).
    expect(instructorAfter.earningsBalance).toBe(8000);
  });

  it('PRODUCT: credits the creator from amountGel, not the USD-converted amount', async () => {
    await upsertCommissionPercentage('DIGITAL_PRODUCT_VERIFIED', 20, 'test');
    const buyer = await createUser();
    const creator = await createUser({ isVerifiedGraduate: true });
    const product = await createDigitalProduct({ submittedById: creator.id, price: 10000 });

    const stripePayment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `test-${randomUUID()}`,
        userId: buyer.id,
        purpose: 'PRODUCT',
        paymentModel: 'DIRECT',
        referenceId: product.id,
        amount: 3300, // EUR-cents equivalent, deliberately different from amountGel
        amountGel: 10000,
        currency: 'EUR',
        status: 'PENDING',
      },
    });

    await applyStripePaymentResult(stripePayment.id, fakeSession, {});

    const creatorAfter = await prisma.user.findUniqueOrThrow({ where: { id: creator.id } });
    expect(creatorAfter.earningsBalance).toBe(8000);
  });
});
