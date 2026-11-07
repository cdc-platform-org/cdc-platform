import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { BogPaymentPurpose } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createCourse, createDigitalProduct, createUser } from '../../test/factories';
import adminFinanceRouter from '../adminFinance';
import adminPanelRouter from '../adminPanel';
import { errorHandler } from '../../middleware/errorHandler';
import { refundBogOrder, BogRefundRejectedError } from '../../services/bogPaymentService';

// Only the outbound HTTP call to BOG is mocked — everything else (DB writes,
// access revocation, clawback, audit log) runs for real against the test DB.
jest.mock('../../services/bogPaymentService', () => {
  const actual = jest.requireActual('../../services/bogPaymentService');
  return { ...actual, refundBogOrder: jest.fn() };
});

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/admin/finance', adminFinanceRouter);
  app.use('/admin-panel', adminPanelRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(refundBogOrder).mockResolvedValue({ key: 'request_received', actionId: 'bog-action-1', raw: { key: 'request_received', action_id: 'bog-action-1' } });
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

function request(path: string, user: User, method = 'GET', body?: unknown) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.7.${++requestNumber % 250}`, Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createPayment(params: { userId: string; purpose: BogPaymentPurpose; referenceId: string; amount: number }) {
  return prisma.bogPayment.create({
    data: {
      bogOrderId: `bog-${randomUUID()}`,
      userId: params.userId,
      purpose: params.purpose,
      paymentModel: ['MENTORSHIP', 'HR_SUPPORT', 'GIG_ESCROW_FUNDING'].includes(params.purpose) ? 'ESCROW' : 'DIRECT',
      referenceId: params.referenceId,
      amount: params.amount,
      currency: 'GEL',
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

describe('admin BOG refunds', () => {
  it('full course refund: calls BOG without amount, removes enrollment, claws back instructor share, audits', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const instructor = await createUser({ earningsBalance: 8000 });
    const student = await createUser();
    const course = await createCourse({ instructorId: instructor.id });
    await prisma.courseEnrollment.create({ data: { userId: student.id, courseId: course.id, commissionRate: 0.2, commissionAmount: 2000, netAmount: 8000 } });
    const payment = await createPayment({ userId: student.id, purpose: 'COURSE', referenceId: course.id, amount: 10000 });

    const res = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', { reason: 'Customer asked' });
    expect(res.status).toBe(200);

    expect(refundBogOrder).toHaveBeenCalledTimes(1);
    const call = jest.mocked(refundBogOrder).mock.calls[0][0];
    expect(call.bogOrderId).toBe(payment.bogOrderId);
    expect(call.amount).toBeUndefined();

    const fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('REFUNDED');
    expect(fresh.refundedAmount).toBe(10000);

    const refund = await prisma.bogRefund.findFirstOrThrow({ where: { bogPaymentId: payment.id } });
    expect(refund.status).toBe('SUCCEEDED');
    expect(refund.id).toBe(call.idempotencyKey);
    expect(refund.bogActionId).toBe('bog-action-1');
    expect(refund.accessRevoked).toBe(true);

    expect(await prisma.courseEnrollment.count({ where: { userId: student.id, courseId: course.id } })).toBe(0);
    const instructorAfter = await prisma.user.findUniqueOrThrow({ where: { id: instructor.id } });
    expect(instructorAfter.earningsBalance).toBe(0);
    expect(await prisma.walletEntry.count({ where: { userId: instructor.id, type: 'REFUND_CLAWBACK', amount: -8000 } })).toBe(1);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'finance.payment.refund', targetId: payment.id } });
    expect(audit.performedById).toBe(admin.id);
    expect((audit.metadata as Record<string, unknown>).reason).toBe('Customer asked');
  });

  it('partial product refunds keep access when asked, sum up, and claw back proportionally', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const creator = await createUser({ earningsBalance: 4000 });
    const buyer = await createUser();
    const product = await createDigitalProduct({ submittedById: creator.id, price: 5000 });
    await prisma.productPurchase.create({ data: { userId: buyer.id, productId: product.id, amount: 5000, paymentStatus: 'COMPLETED', commissionAmount: 1000, netAmount: 4000 } });
    const payment = await createPayment({ userId: buyer.id, purpose: 'PRODUCT', referenceId: product.id, amount: 5000 });

    const first = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', { amount: 2.5, revokeAccess: false });
    expect(first.status).toBe(200);
    expect(jest.mocked(refundBogOrder).mock.calls[0][0].amount).toBe(250);
    let fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('PARTIALLY_REFUNDED');
    expect(fresh.refundedAmount).toBe(250);
    expect((await prisma.productPurchase.findFirstOrThrow({ where: { userId: buyer.id, productId: product.id } })).paymentStatus).toBe('COMPLETED');

    // Refund the rest (no amount = everything left) and revoke.
    const second = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', { revokeAccess: true });
    expect(second.status).toBe(200);
    expect(jest.mocked(refundBogOrder).mock.calls[1][0].amount).toBe(4750);
    fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('REFUNDED');
    expect(fresh.refundedAmount).toBe(5000);
    expect((await prisma.productPurchase.findFirstOrThrow({ where: { userId: buyer.id, productId: product.id } })).paymentStatus).toBe('REFUNDED');

    // 4000 net share fully clawed back across both refunds (200 + 3800).
    expect((await prisma.user.findUniqueOrThrow({ where: { id: creator.id } })).earningsBalance).toBe(0);

    const history = await request(`/admin/finance/course-payments/${payment.id}/refunds`, admin);
    expect(((await history.json()) as { data: unknown[] }).data).toHaveLength(2);
  });

  it('rejects a refund larger than what is left, without calling BOG', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const buyer = await createUser();
    const payment = await createPayment({ userId: buyer.id, purpose: 'CHILDRENS_BOOK', referenceId: randomUUID(), amount: 500 });
    const res = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', { amount: 6 });
    expect(res.status).toBe(400);
    expect(refundBogOrder).not.toHaveBeenCalled();
    expect((await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('COMPLETED');
  });

  it('when BOG rejects the refund, nothing changes and the attempt is recorded as FAILED', async () => {
    jest.mocked(refundBogOrder).mockRejectedValueOnce(new BogRefundRejectedError(400, '{"message":"not refundable"}'));
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const buyer = await createUser();
    const payment = await createPayment({ userId: buyer.id, purpose: 'CHILDRENS_BOOK', referenceId: randomUUID(), amount: 500 });

    const res = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', {});
    expect(res.status).toBe(502);
    const fresh = await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(fresh.status).toBe('COMPLETED');
    expect(fresh.refundedAmount).toBe(0);
    expect((await prisma.bogRefund.findFirstOrThrow({ where: { bogPaymentId: payment.id } })).status).toBe('FAILED');
    expect(await prisma.auditLog.count({ where: { action: 'finance.payment.refund.failed', targetId: payment.id } })).toBe(1);

    // A failed attempt does not block a retry.
    const retry = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', {});
    expect(retry.status).toBe(200);
  });

  it('record-only mode does not call BOG', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const buyer = await createUser();
    const payment = await createPayment({ userId: buyer.id, purpose: 'CHILDRENS_BOOK', referenceId: randomUUID(), amount: 500 });
    const res = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', { recordOnly: true });
    expect(res.status).toBe(200);
    expect(refundBogOrder).not.toHaveBeenCalled();
    expect((await prisma.bogPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('REFUNDED');
  });

  it('refuses partial refunds on escrow payments', async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const buyer = await createUser();
    const payment = await createPayment({ userId: buyer.id, purpose: 'GIG_ESCROW_FUNDING', referenceId: randomUUID(), amount: 5000 });
    const res = await request(`/admin/finance/course-payments/${payment.id}/refund`, admin, 'POST', { amount: 10 });
    expect(res.status).toBe(400);
    expect(refundBogOrder).not.toHaveBeenCalled();
  });

  it('only SUPER_ADMIN can refund', async () => {
    const manager = await createUser({ adminRole: 'MANAGER' });
    const buyer = await createUser();
    const payment = await createPayment({ userId: buyer.id, purpose: 'CHILDRENS_BOOK', referenceId: randomUUID(), amount: 500 });
    const res = await request(`/admin/finance/course-payments/${payment.id}/refund`, manager, 'POST', {});
    expect(res.status).toBe(403);
    expect(refundBogOrder).not.toHaveBeenCalled();
  });
});

describe('admin dashboard revenue', () => {
  it("counts children's book and other purchase types, net of partial refunds", async () => {
    const admin = await createUser({ adminRole: 'SUPER_ADMIN' });
    const buyer = await createUser();
    const stats = async () => ((await (await request('/admin-panel/dashboard-stats', admin)).json()) as { volume: { totalGrossAmount: number; transactionCount: number } }).volume;

    const before = await stats();
    await createPayment({ userId: buyer.id, purpose: 'CHILDRENS_BOOK', referenceId: randomUUID(), amount: 500 });
    await createPayment({ userId: buyer.id, purpose: 'LIVE_TRAINING', referenceId: randomUUID(), amount: 1500 });
    const partial = await createPayment({ userId: buyer.id, purpose: 'ENGLISH_TUTOR_SUBSCRIPTION', referenceId: buyer.id, amount: 5000 });
    await prisma.bogPayment.update({ where: { id: partial.id }, data: { status: 'PARTIALLY_REFUNDED', refundedAmount: 1000 } });
    const full = await createPayment({ userId: buyer.id, purpose: 'PRODUCT', referenceId: randomUUID(), amount: 9999 });
    await prisma.bogPayment.update({ where: { id: full.id }, data: { status: 'REFUNDED', refundedAmount: 9999 } });

    const after = await stats();
    expect(after.totalGrossAmount - before.totalGrossAmount).toBe(500 + 1500 + 4000);
    expect(after.transactionCount - before.transactionCount).toBe(3);
  });
});
