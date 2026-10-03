import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { BogPaymentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { applyStripePaymentResult } from '../stripePayments';
import { upsertCommissionPercentage } from '../../services/platformFeeScheduleService';
import { createUser, createCourse } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

const fakeSession = { payment_intent: 'pi_test_fake', payment_status: 'paid' } as unknown as Stripe.Checkout.Session;

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

// Regression coverage for the 2026-10 Stripe audit's MEDIUM finding:
// GET /payments/stripe/status/:paymentId (the frontend's post-redirect poll)
// and the Stripe webhook can both observe the same PENDING StripePayment
// before either has written, then both call applyStripePaymentResult —
// completeTutorSubscriptionPurchase (unlike every other fulfillment
// purpose) had no idempotency guard of its own, so a race or a redelivered
// webhook could extend the subscription by 30 days twice. These tests
// exercise the fix (completeTutorSubscriptionStripePayment's row-locked
// claim) through the real entry point, applyStripePaymentResult, against a
// real test-database transaction/lock — no Stripe network calls anywhere
// here, same as the suite above.
describe('applyStripePaymentResult — ENGLISH_TUTOR_SUBSCRIPTION idempotency', () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  async function createPendingTutorPayment(userId: string, overrides: { status?: BogPaymentStatus; completedAt?: Date } = {}) {
    return prisma.stripePayment.create({
      data: {
        stripeSessionId: `test-${randomUUID()}`,
        userId,
        purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
        paymentModel: 'DIRECT',
        referenceId: userId,
        amount: 1800,
        amountGel: 5000,
        currency: 'USD',
        status: 'PENDING',
        ...overrides,
      },
    });
  }

  it('first successful fulfillment extends entitlement exactly once', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    await applyStripePaymentResult(payment.id, fakeSession, {});

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const paymentAfter = await prisma.stripePayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(userAfter.tutorSubscriptionTier).toBe('PRO');
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + THIRTY_DAYS_MS - 5000);
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeLessThan(Date.now() + THIRTY_DAYS_MS + 5000);
    expect(paymentAfter.status).toBe('COMPLETED');
  });

  it('duplicate webhook delivery for the same payment does not extend again', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    await applyStripePaymentResult(payment.id, fakeSession, {});
    const periodEndAfterFirst = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tutorSubscriptionPeriodEnd;

    // Simulates Stripe redelivering the same checkout.session.completed event.
    await applyStripePaymentResult(payment.id, fakeSession, {});
    const periodEndAfterRedelivery = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tutorSubscriptionPeriodEnd;

    expect(periodEndAfterRedelivery!.getTime()).toBe(periodEndAfterFirst!.getTime());
  });

  it('webhook + status-poll race does not double-extend (30 days once, not 60)', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    // Simulates the exact race: the webhook and the frontend's /status poll
    // both reach applyStripePaymentResult for the same PENDING payment at
    // the same time.
    await Promise.all([
      applyStripePaymentResult(payment.id, fakeSession, { source: 'webhook' }),
      applyStripePaymentResult(payment.id, fakeSession, { source: 'status-poll' }),
    ]);

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + THIRTY_DAYS_MS - 5000);
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeLessThan(Date.now() + THIRTY_DAYS_MS + 5000);
  });

  it('an already-COMPLETED StripePayment is a no-op', async () => {
    const fixedPeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days out, from an earlier purchase
    const user = await createUser({ tutorSubscriptionTier: 'PRO', tutorSubscriptionPeriodEnd: fixedPeriodEnd });
    const payment = await createPendingTutorPayment(user.id, { status: 'COMPLETED', completedAt: new Date() });

    await applyStripePaymentResult(payment.id, fakeSession, {});

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBe(fixedPeriodEnd.getTime());
  });

  it('an unpaid/failed session grants no entitlement', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);
    const unpaidSession = { payment_intent: 'pi_test_unpaid', payment_status: 'unpaid' } as unknown as Stripe.Checkout.Session;

    await applyStripePaymentResult(payment.id, unpaidSession, {});

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const paymentAfter = await prisma.stripePayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(userAfter.tutorSubscriptionTier).toBe('FREE');
    expect(userAfter.tutorSubscriptionPeriodEnd).toBeNull();
    expect(paymentAfter.status).toBe('PENDING');
  });
});
