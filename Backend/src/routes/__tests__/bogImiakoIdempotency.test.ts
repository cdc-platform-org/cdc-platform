import { randomUUID } from 'crypto';
import { BogPaymentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { applyBogPaymentResult } from '../payments';
import { createUser } from '../../test/factories';

afterAll(async () => {
  await prisma.$disconnect();
});

// Regression coverage for the BOG counterpart of the Stripe
// ENGLISH_TUTOR_SUBSCRIPTION idempotency fix (see
// routes/__tests__/stripePayments.test.ts's identical suite): BOG's
// callback and its GET /bog/status/:paymentId reconciliation poll can both
// observe the same PENDING BogPayment before either has written, then both
// call applyBogPaymentResult — completeTutorSubscriptionPurchase itself has
// no idempotency guard, so a race or a redelivered callback could extend
// the subscription by 30 days twice. These tests exercise the fix
// (completeTutorSubscriptionBogPayment's row-locked claim) through the real
// entry point, applyBogPaymentResult, against the real test database — no
// BOG network calls anywhere here; applyBogPaymentResult never calls BOG's
// API itself, it only acts on the statusKey/rawCallback already passed in.
describe('applyBogPaymentResult — ENGLISH_TUTOR_SUBSCRIPTION idempotency', () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  async function createPendingTutorPayment(userId: string, overrides: { status?: BogPaymentStatus; completedAt?: Date } = {}) {
    return prisma.bogPayment.create({
      data: {
        bogOrderId: `test-${randomUUID()}`,
        userId,
        purpose: 'ENGLISH_TUTOR_SUBSCRIPTION',
        paymentModel: 'DIRECT',
        referenceId: userId,
        amount: 5000,
        currency: 'GEL',
        status: 'PENDING',
        ...overrides,
      },
    });
  }

  it('first successful completion grants entitlement exactly once', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    await applyBogPaymentResult(payment.id, 'completed', {});

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const paymentAfter = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(userAfter.tutorSubscriptionTier).toBe('PRO');
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + THIRTY_DAYS_MS - 5000);
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeLessThan(Date.now() + THIRTY_DAYS_MS + 5000);
    expect(paymentAfter.status).toBe('COMPLETED');
  });

  it('duplicate callback delivery for the same payment does not extend again', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    await applyBogPaymentResult(payment.id, 'completed', {});
    const periodEndAfterFirst = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tutorSubscriptionPeriodEnd;

    // Simulates BOG redelivering the same "completed" callback.
    await applyBogPaymentResult(payment.id, 'completed', {});
    const periodEndAfterRedelivery = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).tutorSubscriptionPeriodEnd;

    expect(periodEndAfterRedelivery!.getTime()).toBe(periodEndAfterFirst!.getTime());
  });

  it('callback + status-poll race does not double-extend (30 days once, not 60)', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    // Simulates the exact race: the BOG callback and the frontend's
    // /bog/status poll both reach applyBogPaymentResult for the same
    // PENDING payment at the same time.
    await Promise.all([
      applyBogPaymentResult(payment.id, 'completed', { source: 'callback' }),
      applyBogPaymentResult(payment.id, 'completed', { source: 'status-poll' }),
    ]);

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + THIRTY_DAYS_MS - 5000);
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBeLessThan(Date.now() + THIRTY_DAYS_MS + 5000);
  });

  it('an already-COMPLETED BogPayment is a no-op', async () => {
    const fixedPeriodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days out, from an earlier purchase
    const user = await createUser({ tutorSubscriptionTier: 'PRO', tutorSubscriptionPeriodEnd: fixedPeriodEnd });
    const payment = await createPendingTutorPayment(user.id, { status: 'COMPLETED', completedAt: new Date() });

    await applyBogPaymentResult(payment.id, 'completed', {});

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(userAfter.tutorSubscriptionPeriodEnd!.getTime()).toBe(fixedPeriodEnd.getTime());
  });

  it('a rejected/failed BOG payment grants no entitlement', async () => {
    const user = await createUser();
    const payment = await createPendingTutorPayment(user.id);

    await applyBogPaymentResult(payment.id, 'rejected', {});

    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const paymentAfter = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(userAfter.tutorSubscriptionTier).toBe('FREE');
    expect(userAfter.tutorSubscriptionPeriodEnd).toBeNull();
    expect(paymentAfter.status).toBe('FAILED');
  });
});
