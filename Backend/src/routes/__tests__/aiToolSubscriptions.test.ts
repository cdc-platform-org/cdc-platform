import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser, createCourse } from '../../test/factories';
import paymentsRouter, { applyBogPaymentResult } from '../payments';
import digitalToolsRouter from '../digitalTools';
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/payments/bogPaymentService';
import { revokeAiToolSubscriptionPayment } from '../../services/payments/aiToolSubscriptionService';
import { hasDigitalToolAccess } from '../../services/marketplace/digitalToolAccessService';

jest.mock('../../services/payments/bogPaymentService', () => ({ ...jest.requireActual('../../services/payments/bogPaymentService'), createBogOrder: jest.fn() }));
let server: Server;
let base: string;
let requestNumber = 0;
const users: string[] = [], courses: string[] = [];
async function buyer() { const user = await createUser({ role: 'Student' }); users.push(user.id); return user; }
type Buyer = Awaited<ReturnType<typeof buyer>>;
async function api(user: Buyer | null, path: string, body?: unknown) {
 const token = user ? jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' }) : null;
 return fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.7.${++requestNumber % 250}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
async function order(user: Buyer, tool = 'media-studio') {
 const response = await api(user, `/api/payments/checkout/ai-tool/${tool}`, {}); expect(response.status).toBe(201);
 return (await response.json()) as { paymentId: string; redirectUrl: string };
}
beforeAll(async () => { const app = express(); app.set('trust proxy', true); app.use(express.json()); app.use('/api/payments', paymentsRouter); app.use('/api/digital-tools', digitalToolsRouter); app.use(errorHandler); server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); }); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`; });
beforeEach(() => { jest.clearAllMocks(); jest.mocked(createBogOrder).mockImplementation(async () => ({ bogOrderId: `ai-tool-${randomUUID()}`, redirectUrl: 'https://payments.example.test/ai-tool' })); });
afterAll(async () => {
 if (server) await new Promise<void>(resolve => server.close(() => resolve()));
 await prisma.accessGrant.deleteMany({ where: { OR: [{ userId: { in: users } }, { createdById: { in: users } }] } });
 await prisma.bogPayment.deleteMany({ where: { userId: { in: users } } });
 await prisma.courseEnrollment.deleteMany({ where: { userId: { in: users } } });
 await prisma.course.deleteMany({ where: { id: { in: courses } } });
 await prisma.user.deleteMany({ where: { id: { in: users } } });
 await prisma.$disconnect();
});

test('all registered AI tools expose the same 29 GEL monthly price', async () => {
 const response = await api(null, '/api/digital-tools/catalog'); expect(response.status).toBe(200);
 const { data } = await response.json() as { data: { key: string; priceMinor: number; periodDays: number }[] };
 expect(data.length).toBeGreaterThanOrEqual(9); expect(data.every(tool => tool.priceMinor === 2900 && tool.periodDays === 30)).toBe(true);
});
test('checkout ignores a forged price and does not grant access before payment', async () => {
 const user = await buyer(); const response = await api(user, '/api/payments/checkout/ai-tool/media-studio', { price: 1, periodDays: 99999 }); expect(response.status).toBe(201);
 const { paymentId } = await response.json() as { paymentId: string };
 expect((await prisma.bogPayment.findUniqueOrThrow({ where: { id: paymentId } })).amount).toBe(2900);
 expect(jest.mocked(createBogOrder).mock.calls[0][0].amount).toBe(2900);
 expect(await hasDigitalToolAccess(user.id, user.email, 'media-studio')).toBe(false);
});
test('repeated concurrent completion grants exactly one month to only the purchased tool', async () => {
 const user = await buyer(); const { paymentId } = await order(user);
 await Promise.all([applyBogPaymentResult(paymentId, 'completed', {}), applyBogPaymentResult(paymentId, 'completed', {})]);
 const grants = await prisma.accessGrant.findMany({ where: { userId: user.id } }); expect(grants).toHaveLength(1);
 expect(grants[0].expiresAt!.getTime() - grants[0].startsAt!.getTime()).toBe(30 * 86400000);
 expect(await hasDigitalToolAccess(user.id, user.email, 'media-studio')).toBe(true);
 expect(await hasDigitalToolAccess(user.id, user.email, 'smart-reader')).toBe(false);
});
test('early renewal appends another month without losing existing paid days', async () => {
 const user = await buyer(); const first = await order(user); await applyBogPaymentResult(first.paymentId, 'completed', {});
 const second = await order(user); await applyBogPaymentResult(second.paymentId, 'completed', {});
 const grants = await prisma.accessGrant.findMany({ where: { userId: user.id }, orderBy: { startsAt: 'asc' } });
 expect(grants).toHaveLength(2); expect(grants[1].startsAt!.getTime()).toBe(grants[0].expiresAt!.getTime());
 expect(grants[1].expiresAt!.getTime() - grants[0].startsAt!.getTime()).toBe(60 * 86400000);
});
test('expired and refunded periods cease granting access without a cron job', async () => {
 const user = await buyer(); const { paymentId } = await order(user); await applyBogPaymentResult(paymentId, 'completed', {});
 await prisma.$transaction(tx => revokeAiToolSubscriptionPayment(tx, paymentId));
 expect(await hasDigitalToolAccess(user.id, user.email, 'media-studio')).toBe(false);
 const next = await order(user); await applyBogPaymentResult(next.paymentId, 'completed', {});
 await prisma.accessGrant.updateMany({ where: { userId: user.id }, data: { startsAt: new Date(Date.now() - 2 * 86400000), expiresAt: new Date(Date.now() - 86400000) } });
 expect(await hasDigitalToolAccess(user.id, user.email, 'media-studio')).toBe(false);
});
test('a rejected payment grants no subscription', async () => {
 const user = await buyer(); const { paymentId } = await order(user); await applyBogPaymentResult(paymentId, 'rejected', {});
 expect(await prisma.accessGrant.count({ where: { userId: user.id } })).toBe(0);
 expect(await hasDigitalToolAccess(user.id, user.email, 'media-studio')).toBe(false);
});
test('active college learners receive included access without opening a payment', async () => {
 const user = await buyer(); const course = await createCourse({}); courses.push(course.id);
 await prisma.courseSection.create({ data: { courseId: course.id, title: 'Learning', order: 0, lessons: { create: { title: 'Foundations', order: 0 } } } });
 await prisma.courseEnrollment.create({ data: { userId: user.id, courseId: course.id } });
 const response = await api(user, '/api/payments/checkout/ai-tool/media-studio', {}); expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({ included: true, enrolled: true, redirectUrl: null });
 expect(createBogOrder).not.toHaveBeenCalled();
});
test('unknown tools and unsigned requests cannot create subscription payments', async () => {
 const user = await buyer(); expect((await api(user, '/api/payments/checkout/ai-tool/unknown', {})).status).toBe(404);
 expect((await api(null, '/api/payments/checkout/ai-tool/media-studio', {})).status).toBe(401);
 expect(createBogOrder).not.toHaveBeenCalled();
});
