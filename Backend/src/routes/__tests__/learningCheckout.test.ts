import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser, createCourse } from '../../test/factories';
import paymentsRouter, { applyBogPaymentResult } from '../payments';
import stripePaymentsRouter, { applyStripePaymentResult, markStripeCheckoutExpired } from '../stripePayments';
import liveTrainingsRouter from '../liveTrainings';
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/bogPaymentService';
import { createStripeCheckoutSession } from '../../services/stripePaymentService';
import { notifyCourseEnrollment } from '../../services/courseEnrollmentNotification';
import * as feeSchedule from '../../services/platformFeeScheduleService';
import { quotePromoToCheckout, claimPromoRedemption } from '../../services/couponService';

jest.mock('../../services/bogPaymentService', () => ({
  ...jest.requireActual('../../services/bogPaymentService'),
  createBogOrder: jest.fn(),
}));
jest.mock('../../services/stripePaymentService', () => ({
  ...jest.requireActual('../../services/stripePaymentService'),
  createStripeCheckoutSession: jest.fn(),
}));
jest.mock('../../services/emailService', () => ({
  sendLiveTrainingRegistrationEmail: jest.fn().mockResolvedValue(undefined),
  sendLiveTrainingEnrollmentEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/whatsappService', () => ({
  sendRegistrationStatusWhatsApp: jest.fn().mockResolvedValue(undefined),
  formatWhatsAppDate: jest.fn().mockReturnValue('December 2026'),
}));
jest.mock('../../services/courseEnrollmentNotification', () => ({ notifyCourseEnrollment: jest.fn().mockResolvedValue(undefined) }));

let server: Server;
let baseUrl: string;
let requestNumber = 0;
const paidSession = { payment_status: 'paid', payment_intent: 'pi_test_fake' } as Stripe.Checkout.Session;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/payments/stripe', stripePaymentsRouter);
  app.use('/payments', paymentsRouter);
  app.use('/live-trainings', liveTrainingsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createBogOrder).mockImplementation(async () => ({ bogOrderId: `order-${randomUUID()}`, redirectUrl: 'https://payments.example.test/bog' }));
  jest.mocked(createStripeCheckoutSession).mockImplementation(async () => ({ stripeSessionId: `cs_test_${randomUUID()}`, checkoutUrl: 'https://payments.example.test/stripe' }));
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await prisma.$disconnect();
});

type User = Awaited<ReturnType<typeof createUser>>;
function post(path: string, user?: User, body: unknown = {}) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: JSON.stringify(body),
  });
}

async function training(maxCapacity = 20, price: number | null = 10000) {
  return prisma.liveTraining.create({ data: {
    title: 'Checkout integration training', description: 'An isolated test training.', category: 'Engineering',
    scheduledAt: new Date('2026-12-01T12:00:00Z'), published: true, maxCapacity, price,
  } });
}

async function promo(discountPercent = 20, maxUses: number | null = null) {
  return prisma.promoCode.create({ data: { code: `TEST-${randomUUID()}`.toUpperCase(), discountPercent, maxUses } });
}

describe('learning checkout pricing and retries', () => {
  it.each(['course', 'live-training'] as const)('requests a 31-minute Stripe session for a paid %s', async (purpose) => {
    const buyer = await createUser();
    const target = purpose === 'course' ? await createCourse({}) : await training();
    const before = Math.floor(Date.now() / 1000);
    const response = await post(`/payments/stripe/checkout/${purpose}/${target.id}`, buyer);
    const after = Math.floor(Date.now() / 1000);
    expect(response.status).toBe(201);
    expect(createStripeCheckoutSession).toHaveBeenCalledTimes(1);
    const { expiresAt } = jest.mocked(createStripeCheckoutSession).mock.calls[0][0];
    expect(expiresAt).toBeGreaterThanOrEqual(before + 31 * 60);
    expect(expiresAt).toBeLessThanOrEqual(after + 31 * 60);
  });

  it.each(['BOG', 'STRIPE'] as const)('%s charges the active live training sale price even for an admin', async (gateway) => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const target = await training();
    await prisma.liveTraining.update({ where: { id: target.id }, data: { isOnSale: true, discountPercent: 30 } });
    const code = await promo(20);
    const prefix = gateway === 'STRIPE' ? '/payments/stripe' : '/payments';
    const response = await post(`${prefix}/checkout/live-training/${target.id}`, admin, { promoCode: code.code, currency: 'EUR' });
    expect(response.status).toBe(201);
    const { paymentId } = await response.json() as { paymentId: string };
    const payment = gateway === 'BOG'
      ? await prisma.bogPayment.findUniqueOrThrow({ where: { id: paymentId } })
      : await prisma.stripePayment.findUniqueOrThrow({ where: { id: paymentId } });
    expect('amountGel' in payment ? payment.amountGel : payment.amount).toBe(7000);
    expect(payment.status).toBe('PENDING');
    expect(await prisma.liveTrainingEnrollment.count({ where: { liveTrainingId: target.id } })).toBe(0);
    if (gateway === 'BOG') expect(createBogOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 7000 }));
    else expect(createStripeCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ currency: 'eur' }));
  });

  it.each(['BOG', 'STRIPE'] as const)('%s reuses a pending checkout without spending a single-use promo again', async (gateway) => {
    const buyer = await createUser();
    const target = await training();
    const code = await promo(20, 1);
    const path = `${gateway === 'STRIPE' ? '/payments/stripe' : '/payments'}/checkout/live-training/${target.id}`;
    const first = await post(path, buyer, { promoCode: code.code });
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    const retry = await post(path, buyer, { promoCode: code.code });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(firstBody);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: code.id } })).currentUses).toBe(1);
    expect(gateway === 'BOG' ? createBogOrder : createStripeCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it.each(['BOG', 'STRIPE'] as const)('%s fulfills a 100%% promo atomically without calling a gateway', async (gateway) => {
    const buyer = await createUser();
    const target = await training();
    const code = await promo(100, 1);
    const response = await post(`${gateway === 'STRIPE' ? '/payments/stripe' : '/payments'}/checkout/live-training/${target.id}`, buyer, { promoCode: code.code });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ enrolled: true, redirectUrl: null });
    expect(await prisma.liveTrainingEnrollment.count({ where: { userId: buyer.id, liveTrainingId: target.id, status: 'ACTIVE' } })).toBe(1);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: code.id } })).currentUses).toBe(1);
    expect(createBogOrder).not.toHaveBeenCalled();
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
  });

  it('rejects invalid, expired, exhausted and mismatched promo codes before creating orders', async () => {
    const buyer = await createUser();
    const target = await training();
    const expired = await promo();
    const exhausted = await promo(20, 0);
    const mismatch = await promo();
    await prisma.promoCode.update({ where: { id: expired.id }, data: { expiresAt: new Date('2020-01-01') } });
    await prisma.promoCode.update({ where: { id: mismatch.id }, data: { applicableType: 'COURSE', applicableTargetIds: [target.id] } });
    for (const code of ['INVALID', expired.code, exhausted.code, mismatch.code]) {
      const response = await post(`/payments/checkout/live-training/${target.id}`, buyer, { promoCode: code });
      expect(response.status).toBe(400);
    }
    expect(await prisma.bogPayment.count({ where: { userId: buyer.id } })).toBe(0);
    expect(createBogOrder).not.toHaveBeenCalled();
  });

  it('does not create another payable order after changing promo, currency or gateway', async () => {
    const buyer = await createUser();
    const target = await training();
    const first = await post(`/payments/stripe/checkout/live-training/${target.id}`, buyer);
    expect(first.status).toBe(201);
    const { paymentId } = await first.json() as { paymentId: string };
    // Real Stripe sessions outlive the old 15-minute local reuse window.
    await prisma.stripePayment.update({ where: { id: paymentId }, data: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
    const code = await promo();
    for (const [prefix, body] of [
      ['/payments/stripe', { currency: 'EUR' }],
      ['/payments/stripe', { promoCode: code.code }],
      ['/payments', {}],
    ] as const) {
      expect((await post(`${prefix}/checkout/live-training/${target.id}`, buyer, body)).status).toBe(409);
    }
    expect((await post(`/payments/stripe/checkout/live-training/${target.id}`, buyer)).status).toBe(200);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: code.id } })).currentUses).toBe(0);
    expect(createStripeCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createBogOrder).not.toHaveBeenCalled();
  });
});

describe('learning capacity and coupon concurrency', () => {
  it.each(['BANNED', 'DEACTIVATED', 'DELETED'] as const)('rejects %s accounts from free enrollment before they consume a seat', async (condition) => {
    const buyer = await createUser();
    const target = await training(1, null);
    if (condition === 'DELETED') await prisma.user.delete({ where: { id: buyer.id } });
    else await prisma.user.update({ where: { id: buyer.id }, data: condition === 'BANNED' ? { isBanned: true } : { deletionRequestedAt: new Date() } });
    const response = await post(`/live-trainings/${target.id}/enroll`, buyer);
    expect(response.status).toBe(condition === 'DELETED' ? 401 : 403);
    expect(await prisma.liveTrainingEnrollment.count({ where: { liveTrainingId: target.id } })).toBe(0);
    expect(createBogOrder).not.toHaveBeenCalled();
    expect(createStripeCheckoutSession).not.toHaveBeenCalled();
  });

  it('reserves the final paid seat only once across gateways', async () => {
    const buyers = await Promise.all([createUser(), createUser()]);
    const target = await training(1);
    const responses = await Promise.all([
      post(`/payments/checkout/live-training/${target.id}`, buyers[0]),
      post(`/payments/stripe/checkout/live-training/${target.id}`, buyers[1]),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(jest.mocked(createBogOrder).mock.calls.length + jest.mocked(createStripeCheckoutSession).mock.calls.length).toBe(1);
  });

  it('protects the final course seat while a previous gateway order is still payable', async () => {
    const buyers = await Promise.all([createUser(), createUser()]);
    const target = await createCourse({});
    await prisma.course.update({ where: { id: target.id }, data: { maxCapacity: 1 } });
    expect((await post(`/payments/checkout/course/${target.id}`, buyers[0])).status).toBe(201);
    await prisma.bogPayment.updateMany({ where: { referenceId: target.id }, data: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } });
    expect((await post(`/payments/stripe/checkout/course/${target.id}`, buyers[1])).status).toBe(409);
  });

  it('claims a single-use promo once across two simultaneous free purchases', async () => {
    const buyers = await Promise.all([createUser(), createUser()]);
    const targets = await Promise.all([training(), training()]);
    const code = await promo(100, 1);
    const responses = await Promise.all(targets.map((target, i) => post(`/payments/checkout/live-training/${target.id}`, buyers[i], { promoCode: code.code })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(await prisma.bogPayment.count({ where: { promoCodeId: code.id } })).toBe(1);
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: code.id } })).currentUses).toBe(1);
  });

  it('rejects a promo quote whose cap was reduced by an admin before its atomic claim', async () => {
    const target = await training();
    const code = await promo(20, 10);
    const quoted = await quotePromoToCheckout(code.code, 'LIVE_TRAINING', target.id, 10000);
    await prisma.promoCode.update({ where: { id: code.id }, data: { maxUses: 0 } });
    await expect(claimPromoRedemption(quoted.appliedPromo!)).rejects.toMatchObject({ status: 400 });
    expect((await prisma.promoCode.findUniqueOrThrow({ where: { id: code.id } })).currentUses).toBe(0);
  });

  it('serializes anonymous leads with free enrollment for the last seat', async () => {
    const buyer = await createUser();
    const target = await training(1, null);
    const responses = await Promise.all([
      post(`/live-trainings/${target.id}/register`, undefined, { firstName: 'Nino', lastName: 'Test', phone: '+995599123456' }),
      post(`/live-trainings/${target.id}/enroll`, buyer),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  });

  it('does not reactivate completed enrollments or bypass capacity for a cancelled enrollment', async () => {
    const buyer = await createUser();
    const target = await training(1, null);
    const enrollment = await prisma.liveTrainingEnrollment.create({ data: { userId: buyer.id, liveTrainingId: target.id, status: 'COMPLETED', completedAt: new Date() } });
    expect((await post(`/live-trainings/${target.id}/enroll`, buyer)).status).toBe(400);
    await prisma.liveTrainingEnrollment.update({ where: { id: enrollment.id }, data: { status: 'CANCELLED' } });
    await prisma.liveTrainingLead.create({ data: { liveTrainingId: target.id, name: 'Other Student', phone: '+995577123456' } });
    expect((await post(`/live-trainings/${target.id}/enroll`, buyer)).status).toBe(409);
    expect((await prisma.liveTrainingEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).status).toBe('CANCELLED');
  });
});

describe('learning payment fulfillment', () => {
  it.each(['BOG', 'STRIPE'] as const)('%s keeps failed fulfillment retryable and commits enrollment/payout once', async (gateway) => {
    await feeSchedule.upsertCommissionPercentage('COURSE', 20, 'test');
    const buyer = await createUser();
    const instructor = await createUser({ role: 'Mentor' });
    const target = await createCourse({ instructorId: instructor.id });
    const response = await post(`${gateway === 'STRIPE' ? '/payments/stripe' : '/payments'}/checkout/course/${target.id}`, buyer);
    expect(response.status).toBe(201);
    const { paymentId } = await response.json() as { paymentId: string };
    const complete = () => gateway === 'BOG' ? applyBogPaymentResult(paymentId, 'completed', {}) : applyStripePaymentResult(paymentId, paidSession, {});
    const feeFailure = jest.spyOn(feeSchedule, 'getCommissionRate').mockRejectedValueOnce(new Error('Transient fee lookup failure'));
    await expect(complete()).rejects.toThrow('Transient fee lookup failure');
    feeFailure.mockRestore();
    const failedAttempt = gateway === 'BOG'
      ? await prisma.bogPayment.findUniqueOrThrow({ where: { id: paymentId } })
      : await prisma.stripePayment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(failedAttempt.status).toBe('PENDING');
    expect(await prisma.courseEnrollment.count({ where: { courseId: target.id } })).toBe(0);
    await Promise.all([complete(), complete()]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } })).earningsBalance).toBe(8000);
    expect(await prisma.walletEntry.count({ where: { userId: instructor.id, type: 'COURSE_SALE_CREDIT' } })).toBe(1);
    expect(notifyCourseEnrollment).toHaveBeenCalledTimes(1);
    // A late failed/expired callback cannot overwrite a completed payment.
    if (gateway === 'BOG') await applyBogPaymentResult(paymentId, 'rejected', {});
    else await markStripeCheckoutExpired(paymentId, {});
    const completed = gateway === 'BOG'
      ? await prisma.bogPayment.findUniqueOrThrow({ where: { id: paymentId } })
      : await prisma.stripePayment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(completed.status).toBe('COMPLETED');
  });

  it('does not enroll from an unpaid Stripe completion, and preserves completed training status on retries', async () => {
    const buyer = await createUser();
    const target = await training();
    const response = await post(`/payments/stripe/checkout/live-training/${target.id}`, buyer);
    const { paymentId } = await response.json() as { paymentId: string };
    await applyStripePaymentResult(paymentId, { ...paidSession, payment_status: 'unpaid' }, {});
    expect(await prisma.liveTrainingEnrollment.count({ where: { liveTrainingId: target.id } })).toBe(0);
    expect((await prisma.stripePayment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe('PENDING');
    await Promise.all([applyStripePaymentResult(paymentId, paidSession, {}), applyStripePaymentResult(paymentId, paidSession, {})]);
    expect(await prisma.liveTrainingEnrollment.count({ where: { liveTrainingId: target.id } })).toBe(1);
    await prisma.liveTrainingEnrollment.updateMany({ where: { liveTrainingId: target.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await applyStripePaymentResult(paymentId, paidSession, {});
    expect((await prisma.liveTrainingEnrollment.findFirstOrThrow({ where: { liveTrainingId: target.id } })).status).toBe('COMPLETED');
  });
});
