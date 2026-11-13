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
import bookAnimationRoutes from '../bookAnimation';
import paymentsRouter from '../payments';
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/payments/bogPaymentService';
import * as bookMockConfig from '../../services/childrensBook/bookMockConfig';
import { queuePrepaidAnimations, waitForBookAnimation } from '../../services/childrensBook/bookAnimationService';

// ============================================================
// Children's Book: the animated video can be chosen at checkout, next to
// the audio add-on. It adds 10 GEL to the same payment, and the render is
// queued as already paid once the book is finished (no second charge).
// createBogOrder is mocked so this suite never places a real BOG order.
// ============================================================

jest.mock('../../services/payments/bogPaymentService', () => ({
  ...jest.requireActual('../../services/payments/bogPaymentService'),
  createBogOrder: jest.fn(),
}));
jest.mock('../../services/childrensBook/bookMockConfig', () => ({
  ...jest.requireActual('../../services/childrensBook/bookMockConfig'),
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
  app.use('/api/childrens-books', bookAnimationRoutes);
  app.use('/api/payments', paymentsRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(bookMockConfig.isBookDevPaymentSimulationEnabled).mockReturnValue(false);
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
      'X-Forwarded-For': `198.18.9.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createApprovedBook(user: User): Promise<string> {
  const createRes = await request('/api/childrens-books', user, 'POST', { language: 'EN', title: 'Animated Book', character: { name: 'Sam' }, pageCount: 10 });
  const { data: book } = (await createRes.json()) as { data: { id: string } };
  await request(`/api/childrens-books/${book.id}/story-plan`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/story-text/approve`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-preview`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-approval`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/preview-confirm`, user, 'POST');
  return book.id;
}

type BookDto = { audioAddOnPurchased: boolean; animationAddOnPurchased: boolean; totalPriceGel: number; priceGel: number };

async function setAddOns(user: User, bookId: string, body: Record<string, boolean>): Promise<BookDto> {
  const res = await request(`/api/childrens-books/${bookId}/audio-upgrade`, user, 'PATCH', body);
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: BookDto }).data;
}

describe("Children's Book: animation add-on at checkout", () => {
  it('adds 10 GEL to the total, and the audio and animation toggles never reset each other', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);

    let book = await setAddOns(user, bookId, { animationAddOnPurchased: true });
    expect(book.animationAddOnPurchased).toBe(true);
    expect(book.totalPriceGel).toBe(book.priceGel + 1000);

    book = await setAddOns(user, bookId, { audioAddOnPurchased: true });
    expect(book.animationAddOnPurchased).toBe(true);
    expect(book.totalPriceGel).toBe(book.priceGel + 500 + 1000);

    book = await setAddOns(user, bookId, { animationAddOnPurchased: false });
    expect(book.audioAddOnPurchased).toBe(true);
    expect(book.totalPriceGel).toBe(book.priceGel + 500);
  });

  it('charges book + animation in one BOG order', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const book = await setAddOns(user, bookId, { animationAddOnPurchased: true });

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', {});
    expect(res.status).toBe(201);
    expect(jest.mocked(createBogOrder)).toHaveBeenCalledWith(expect.objectContaining({ amount: book.priceGel + 1000 }));
    const payment = await prisma.bogPayment.findFirstOrThrow({ where: { referenceId: bookId, purpose: 'CHILDRENS_BOOK' } });
    expect(payment.amount).toBe(book.priceGel + 1000);
  });

  it('queues the prepaid animation once the book is finished and never asks for a second payment', async () => {
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    await setAddOns(user, bookId, { animationAddOnPurchased: true });
    await prisma.bookProject.update({ where: { id: bookId }, data: { status: 'PAID' } });

    // Not finished yet: nothing is queued.
    expect(await queuePrepaidAnimations(bookId)).toBe(0);

    await prisma.bookProject.update({ where: { id: bookId }, data: { status: 'FINAL_READY' } });
    const statusRes = await request(`/api/childrens-books/${bookId}/animation`, user);
    expect(((await statusRes.json()) as { data: { prepaid: boolean } }).data.prepaid).toBe(true);

    expect(await queuePrepaidAnimations(bookId)).toBe(1);
    const animation = await prisma.bookAnimation.findUniqueOrThrow({ where: { bookProjectId: bookId } });
    expect(animation.paidVia).toBe('BOOK_CHECKOUT');
    expect(animation.paidAt).not.toBeNull();
    await waitForBookAnimation(animation.id);

    // Idempotent, and the add-on route never opens a BOG order for it.
    expect(await queuePrepaidAnimations(bookId)).toBe(0);
    const buy = await request(`/api/childrens-books/${bookId}/animation`, user, 'POST', {});
    expect(buy.status).toBe(200);
    expect(jest.mocked(createBogOrder)).not.toHaveBeenCalled();
    expect(await prisma.bogPayment.count({ where: { referenceId: bookId, purpose: 'BOOK_ANIMATION' } })).toBe(0);
    await waitForBookAnimation(animation.id);
  });
});
