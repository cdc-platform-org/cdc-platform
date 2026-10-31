import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import childrensBookRoutes from '../childrensBook';
import paymentsRouter from '../payments';
import promosRouter from '../promos';
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/bogPaymentService';
import * as bookMockConfig from '../../services/bookMockConfig';

// ============================================================
// PROMO CODES at checkout — Children's Book and IMIAKO PRO. A Children's Book code targets the
// whole product line (applicableType CHILDRENS_BOOK + fixed target id
// 'childrens-book'), is priced from the book's own pageCount/audio add-on,
// spends its use atomically with the CHARACTER_APPROVED -> PAYMENT_PENDING
// claim, and a 100% code skips BOG entirely. createBogOrder is mocked so
// this suite can never place a real BOG order.
// ============================================================

jest.mock('../../services/bogPaymentService', () => ({
  ...jest.requireActual('../../services/bogPaymentService'),
  createBogOrder: jest.fn(),
}));
jest.mock('../../services/bookMockConfig', () => ({
  ...jest.requireActual('../../services/bookMockConfig'),
  isBookDevPaymentSimulationEnabled: jest.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/childrens-books', childrensBookRoutes);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/promos', promosRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createBogOrder).mockImplementation(async () => ({ bogOrderId: `order-${randomUUID()}`, redirectUrl: 'https://payments.example.test/bog' }));
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

async function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `198.18.8.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createApprovedBook(user: User): Promise<string> {
  const createRes = await request('/api/childrens-books', user, 'POST', {
    language: 'EN',
    title: 'Promo Test Book',
    character: { name: 'Sam' },
    pageCount: 10,
  });
  const { data: book } = (await createRes.json()) as { data: { id: string } };
  await request(`/api/childrens-books/${book.id}/story-plan`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-preview`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-approval`, user, 'POST');
  return book.id;
}


async function createPromo(data: Partial<Parameters<typeof prisma.promoCode.create>[0]['data']> = {}) {
  return prisma.promoCode.create({
    data: {
      code: `BOOK${randomUUID().slice(0, 8).toUpperCase()}`,
      discountPercent: 50,
      applicableType: 'CHILDRENS_BOOK',
      applicableTargetIds: ['childrens-book'],
      ...data,
    },
  });
}

describe("Children's Book — promo codes", () => {
  beforeEach(() => {
    jest.mocked(bookMockConfig.isBookDevPaymentSimulationEnabled).mockReturnValue(false);
  });

  it('POST /promos/validate prices a CHILDRENS_BOOK code against the book (10 pages = 10 GEL -> 5 GEL)', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const promo = await createPromo();

    const res = await request('/api/promos/validate', user, 'POST', { code: promo.code.toLowerCase(), targetType: 'CHILDRENS_BOOK', targetId: bookId });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as { data: { originalAmount: number; discountedAmount: number } };
    expect(data.originalAmount).toBe(1000);
    expect(data.discountedAmount).toBe(500);

    const after = await prisma.promoCode.findUnique({ where: { id: promo.id } });
    expect(after!.currentUses).toBe(0); // a preview never spends a use
  });

  it('a code scoped to another product type is rejected for a book', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const promo = await createPromo({ applicableType: 'COURSE', applicableTargetIds: [randomUUID()] });

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', { promoCode: promo.code });
    expect(res.status).toBe(400);
    expect(createBogOrder).not.toHaveBeenCalled();
    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('CHARACTER_APPROVED');
  });

  it('checkout charges the discounted amount, records the promo and spends one use', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const promo = await createPromo({ discountPercent: 30 });

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', { promoCode: promo.code });
    expect(res.status).toBe(201);
    expect(createBogOrder).toHaveBeenCalledTimes(1);
    expect(jest.mocked(createBogOrder).mock.calls[0][0].amount).toBe(700);

    const payment = await prisma.bogPayment.findFirst({ where: { referenceId: bookId } });
    expect(payment!.amount).toBe(700);
    expect(payment!.promoCodeId).toBe(promo.id);
    expect((await prisma.promoCode.findUnique({ where: { id: promo.id } }))!.currentUses).toBe(1);
    expect((await prisma.bookProject.findUnique({ where: { id: bookId } }))!.status).toBe('PAYMENT_PENDING');
  });

  it('a 100% code skips BOG and marks the book PAID immediately', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const promo = await createPromo({ discountPercent: 100, applicableType: 'ALL', applicableTargetIds: [] });

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', { promoCode: promo.code });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { redirectUrl: string | null; purchased?: boolean };
    expect(body.redirectUrl).toBeNull();
    expect(body.purchased).toBe(true);
    expect(createBogOrder).not.toHaveBeenCalled();

    const payment = await prisma.bogPayment.findFirst({ where: { referenceId: bookId } });
    expect(payment!.status).toBe('COMPLETED');
    expect(payment!.amount).toBe(0);
    expect((await prisma.bookProject.findUnique({ where: { id: bookId } }))!.status).toBe('PAID');
  });

  it('a used-up code is rejected and leaves the book untouched', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const promo = await createPromo({ maxUses: 1, currentUses: 1 });

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', { promoCode: promo.code });
    expect(res.status).toBe(400);
    expect(createBogOrder).not.toHaveBeenCalled();
    expect((await prisma.bookProject.findUnique({ where: { id: bookId } }))!.status).toBe('CHARACTER_APPROVED');
    expect(await prisma.bogPayment.count({ where: { referenceId: bookId } })).toBe(0);
  });
});

describe('IMIAKO PRO (English Tutor) — promo codes', () => {
  it('a checkout with a promo code never reuses an earlier full-price pending order', async () => {
    const user = await createUser();
    const promo = await createPromo({ discountPercent: 20, applicableType: 'AI_TOOL', applicableTargetIds: ['english-tutor'] });

    const fullPrice = await request('/api/payments/checkout/english-tutor', user, 'POST', {});
    expect(fullPrice.status).toBe(201);
    const discounted = await request('/api/payments/checkout/english-tutor', user, 'POST', { promoCode: promo.code });
    expect(discounted.status).toBe(201);

    expect(createBogOrder).toHaveBeenCalledTimes(2);
    expect(jest.mocked(createBogOrder).mock.calls[1][0].amount).toBe(4000);

    // Same code again (duplicate click) reuses the discounted order.
    const again = await request('/api/payments/checkout/english-tutor', user, 'POST', { promoCode: promo.code.toLowerCase() });
    expect(again.status).toBe(200);
    expect(createBogOrder).toHaveBeenCalledTimes(2);
  });
});
