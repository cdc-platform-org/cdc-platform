import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { upsertCommissionPercentage } from '../platformFeeScheduleService';
import { createUser, createCourse, createMentorshipBooking } from '../../test/factories';

// bogPaymentService/stripePaymentService make real network calls
// (BOG's receipt API, Stripe's SDK) — mocked at exactly the two functions
// this sweep calls, same "mock at the external-call boundary, keep
// everything else (prisma, applyBogPaymentResult, applyStripePaymentResult)
// real" approach examProctoringService.test.ts uses for the Gemini SDK.
const mockGetBogOrderDetails = jest.fn();
jest.mock('../bogPaymentService', () => ({
  ...jest.requireActual('../bogPaymentService'),
  getBogOrderDetails: (...args: unknown[]) => mockGetBogOrderDetails(...args),
}));

const mockGetStripeCheckoutSession = jest.fn();
jest.mock('../stripePaymentService', () => ({
  ...jest.requireActual('../stripePaymentService'),
  getStripeCheckoutSession: (...args: unknown[]) => mockGetStripeCheckoutSession(...args),
}));

import { reconcilePendingPayments } from '../paymentReconciliationService';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(() => {
  mockGetBogOrderDetails.mockReset();
  mockGetStripeCheckoutSession.mockReset();
});

// Comfortably past the 30-minute STALE_PENDING_MS threshold.
function staleCreatedAt() {
  return new Date(Date.now() - 31 * 60 * 1000);
}

describe('paymentReconciliationService.reconcilePendingPayments', () => {
  it('BOG: a stale PENDING payment BOG now reports completed is marked COMPLETED and actually fulfilled (course enrollment)', async () => {
    await upsertCommissionPercentage('COURSE', 20, 'test');
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });
    const payment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `real-order-${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 10000,
        currency: 'GEL',
        status: 'PENDING',
        createdAt: staleCreatedAt(),
      },
    });
    mockGetBogOrderDetails.mockResolvedValue({ order_id: payment.bogOrderId, order_status: { key: 'completed' } });

    const result = await reconcilePendingPayments();

    expect(result.bogCompletedIds).toContain(payment.id);
    const fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('COMPLETED');
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId: buyer.id, courseId: course.id } },
    });
    expect(enrollment).not.toBeNull();
  });

  it('BOG: a stale PENDING payment BOG now reports rejected is marked FAILED', async () => {
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });
    const payment = await prisma.bogPayment.create({
      data: {
        bogOrderId: `real-order-${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 10000,
        currency: 'GEL',
        status: 'PENDING',
        createdAt: staleCreatedAt(),
      },
    });
    mockGetBogOrderDetails.mockResolvedValue({ order_id: payment.bogOrderId, order_status: { key: 'rejected' } });

    const result = await reconcilePendingPayments();

    expect(result.bogFailedIds).toContain(payment.id);
    const fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('FAILED');
  });

  it('BOG: skips a payment whose order was never actually created (placeholder bogOrderId) and one that is not yet stale', async () => {
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });
    await prisma.bogPayment.create({
      data: {
        bogOrderId: `pending-${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 10000,
        currency: 'GEL',
        status: 'PENDING',
        createdAt: staleCreatedAt(),
      },
    });
    const notYetStale = await prisma.bogPayment.create({
      data: {
        bogOrderId: `real-order-${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 10000,
        currency: 'GEL',
        status: 'PENDING',
      },
    });

    await reconcilePendingPayments();

    expect(mockGetBogOrderDetails).not.toHaveBeenCalled();
    const fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: notYetStale.id } });
    expect(fresh.status).toBe('PENDING');
  });

  it('Stripe: a stale PENDING payment Stripe now reports paid is marked COMPLETED and fulfilled from amountGel, not amount', async () => {
    await upsertCommissionPercentage('COURSE', 20, 'test');
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });
    const payment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `cs_test_${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 3600, // deliberately different from amountGel, same as stripePayments.test.ts
        amountGel: 10000,
        currency: 'USD',
        status: 'PENDING',
        createdAt: staleCreatedAt(),
      },
    });
    mockGetStripeCheckoutSession.mockResolvedValue({ status: 'complete', payment_status: 'paid', payment_intent: 'pi_test_fake' });

    const result = await reconcilePendingPayments();

    expect(result.stripeCompletedIds).toContain(payment.id);
    const instructorAfter = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
    expect(instructorAfter.earningsBalance).toBe(8000); // 80% of amountGel (10000), not of amount (3600)
  });

  it('Stripe: an expired session is marked FAILED and frees the mentorship slot it was blocking', async () => {
    const mentor = await createUser({ role: 'Mentor', mentorHourlyRate: 5000 });
    const student = await createUser();
    const payment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `cs_test_${randomUUID()}`,
        userId: student.id,
        purpose: 'MENTORSHIP',
        paymentModel: 'ESCROW',
        referenceId: mentor.id,
        amount: 1800,
        amountGel: 5000,
        currency: 'USD',
        status: 'PENDING',
        createdAt: staleCreatedAt(),
      },
    });
    const booking = await createMentorshipBooking({
      mentorId: mentor.id,
      studentId: student.id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await prisma.mentorshipBooking.update({ where: { id: booking.id }, data: { stripePaymentId: payment.id } });
    mockGetStripeCheckoutSession.mockResolvedValue({ status: 'expired', payment_status: 'unpaid' });

    const result = await reconcilePendingPayments();

    expect(result.stripeFailedIds).toContain(payment.id);
    const paymentAfter = await prisma.stripePayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paymentAfter.status).toBe('FAILED');
    const bookingAfter = await prisma.mentorshipBooking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(bookingAfter.status).toBe('CANCELLED');
  });

  it('Stripe: an open (still in-progress) session is left PENDING, untouched', async () => {
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const course = await createCourse({ instructorId: instructor.id, originalPrice: 10000 });
    const payment = await prisma.stripePayment.create({
      data: {
        stripeSessionId: `cs_test_${randomUUID()}`,
        userId: buyer.id,
        purpose: 'COURSE',
        paymentModel: 'DIRECT',
        referenceId: course.id,
        amount: 3600,
        amountGel: 10000,
        currency: 'USD',
        status: 'PENDING',
        createdAt: staleCreatedAt(),
      },
    });
    mockGetStripeCheckoutSession.mockResolvedValue({ status: 'open', payment_status: 'unpaid' });

    const result = await reconcilePendingPayments();

    expect(result.stripeCompletedIds).not.toContain(payment.id);
    expect(result.stripeFailedIds).not.toContain(payment.id);
    const fresh = await prisma.stripePayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('PENDING');
  });
});
