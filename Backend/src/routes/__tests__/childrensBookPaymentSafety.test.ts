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
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/bogPaymentService';
import * as bookMockConfig from '../../services/bookMockConfig';

// ============================================================
// CDC CHILDREN'S BOOK — payment safety hardening.
//
// A real BOG checkout was accidentally created during manual QA because
// the CHARACTER_APPROVED step showed both the real "Pay" button and the
// dev-simulation button together. This suite verifies the fix at both
// layers: the backend checkout route fails closed (403, never reaching
// createBogOrder — mocked below, so this suite can never place a real BOG
// order even if the guard were broken) whenever dev payment simulation is
// enabled, and succeeds normally when it is not.
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
    title: 'Safety Test Book',
    character: { name: 'Sam' },
    pageCount: 10,
  });
  const { data: book } = (await createRes.json()) as { data: { id: string } };
  await request(`/api/childrens-books/${book.id}/story-plan`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-preview`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-approval`, user, 'POST');
  return book.id;
}

describe("Children's Book — payment UI/backend mutual exclusion", () => {
  it('GET /:id reports devPaymentSimulationEnabled=true when the flag is on', async () => {
    jest.mocked(bookMockConfig.isBookDevPaymentSimulationEnabled).mockReturnValue(true);
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const res = await request(`/api/childrens-books/${bookId}`, user);
    const body = (await res.json()) as { devPaymentSimulationEnabled: boolean };
    expect(body.devPaymentSimulationEnabled).toBe(true);
  });

  it('GET /:id reports devPaymentSimulationEnabled=false when the flag is off', async () => {
    jest.mocked(bookMockConfig.isBookDevPaymentSimulationEnabled).mockReturnValue(false);
    const user = await createUser();
    const bookId = await createApprovedBook(user);
    const res = await request(`/api/childrens-books/${bookId}`, user);
    const body = (await res.json()) as { devPaymentSimulationEnabled: boolean };
    expect(body.devPaymentSimulationEnabled).toBe(false);
  });

  it('real checkout is blocked (403) and never reaches createBogOrder when dev simulation is enabled', async () => {
    jest.mocked(bookMockConfig.isBookDevPaymentSimulationEnabled).mockReturnValue(true);
    const user = await createUser();
    const bookId = await createApprovedBook(user);

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', {});
    expect(res.status).toBe(403);
    expect(createBogOrder).not.toHaveBeenCalled();

    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('CHARACTER_APPROVED'); // never claimed into PAYMENT_PENDING
  });

  it('real checkout proceeds normally (mocked BOG call only) when dev simulation is disabled', async () => {
    jest.mocked(bookMockConfig.isBookDevPaymentSimulationEnabled).mockReturnValue(false);
    const user = await createUser();
    const bookId = await createApprovedBook(user);

    const res = await request(`/api/payments/checkout/childrens-book/${bookId}`, user, 'POST', {});
    expect(res.status).toBe(201);
    expect(createBogOrder).toHaveBeenCalledTimes(1);

    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('PAYMENT_PENDING');
  });
});
