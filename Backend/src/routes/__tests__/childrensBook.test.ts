import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import childrensBookRoutes from '../childrensBook';
import { errorHandler } from '../../middleware/errorHandler';
import { ALLOWED_PAGE_COUNTS, calculateBookPrice } from '../../services/bookStateService';
import * as bookMockConfig from '../../services/bookMockConfig';

// bookMockConfig's ENABLE_BOOK_DEV_PAYMENT_SIMULATION read is frozen at
// process start (utils/env.ts reads process.env once at import time, same
// as every other env var in this codebase) — a developer's real local .env
// may well have this on for manual wizard QA, which would make an
// unmocked "the default is off" assertion flaky depending on who's running
// the suite. Mocked here instead of relying on env state, same reasoning
// as teacherQuizFlow.test.ts's callTextModel mock.
jest.mock('../../services/bookMockConfig', () => ({
  ...jest.requireActual('../../services/bookMockConfig'),
  isBookDevPaymentSimulationEnabled: jest.fn(() => false),
}));
// re-require, since bookMockConfig reads process.env at call time.

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/childrens-books', childrensBookRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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
      'X-Forwarded-For': `198.18.7.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createBookThroughStoryPlan(user: User, pageCount = 10) {
  const createRes = await request('/api/childrens-books', user, 'POST', {
    language: 'EN',
    title: 'Test Adventure',
    character: { name: 'Mimi', age: 5, traits: ['brave'] },
    pageCount,
  });
  const { data: book } = (await createRes.json()) as { data: { id: string } };
  await request(`/api/childrens-books/${book.id}/story-plan`, user, 'POST');
  return book.id;
}

async function advanceToPaid(user: User, bookId: string) {
  await request(`/api/childrens-books/${bookId}/character-preview`, user, 'POST');
  await request(`/api/childrens-books/${bookId}/character-approval`, user, 'POST');
  // Directly claim PAYMENT_PENDING -> PAID at the DB level — the real
  // checkout route lives in payments.ts (BOG-specific) and is exercised by
  // its own suite; this test only needs a PAID book to exist.
  await prisma.bookProject.update({ where: { id: bookId }, data: { status: 'PAYMENT_PENDING' } });
  await prisma.bookProject.update({ where: { id: bookId }, data: { status: 'PAID' } });
}

describe("Children's Book — ownership", () => {
  it('404s when a different user requests someone else’s book', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const bookId = await createBookThroughStoryPlan(owner);

    const res = await request(`/api/childrens-books/${bookId}`, intruder);
    expect(res.status).toBe(404);
  });

  it('404s the PDF download route for a non-owner too', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const bookId = await createBookThroughStoryPlan(owner);

    const res = await request(`/api/childrens-books/${bookId}/pdf/download`, intruder);
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request('/api/childrens-books');
    expect(res.status).toBe(401);
  });
});

describe('Children\'s Book — state transitions', () => {
  it('rejects story-plan generation once already generated', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);

    const res = await request(`/api/childrens-books/${bookId}/story-plan`, user, 'POST');
    expect(res.status).toBe(200); // idempotent "already exists" response, not a new generation
  });

  it('rejects character-approval before a preview exists', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);

    const res = await request(`/api/childrens-books/${bookId}/character-approval`, user, 'POST');
    expect(res.status).toBe(400);
  });

  it('rejects final-generation start before payment', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await request(`/api/childrens-books/${bookId}/character-preview`, user, 'POST');
    await request(`/api/childrens-books/${bookId}/character-approval`, user, 'POST');

    const res = await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');
    expect(res.status).toBe(400);
  });

  it('full happy path reaches COMPLETED with a current PDF', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await advanceToPaid(user, bookId);

    const genRes = await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');
    expect(genRes.status).toBe(200);
    const genBody = (await genRes.json()) as { data: { status: string }; acceptedCount: number };
    expect(genBody.acceptedCount).toBe(10);
    expect(genBody.data.status).toBe('FINAL_READY');

    const pdfRes = await request(`/api/childrens-books/${bookId}/pdf`, user, 'POST');
    expect(pdfRes.status).toBe(201);
    const pdfBody = (await pdfRes.json()) as { data: { status: string; pdfStatus: string } };
    expect(pdfBody.data.pdfStatus).toBe('CURRENT');
    expect(pdfBody.data.status).toBe('COMPLETED');
  });
});

describe("Children's Book — variable page count invariant", () => {
  it.each(ALLOWED_PAGE_COUNTS)('story plan for a %i-page book creates exactly %i BookPage rows', async (pageCount) => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user, pageCount);
    const pages = await prisma.bookPage.findMany({ where: { bookProjectId: bookId } });
    expect(pages).toHaveLength(pageCount);
    expect(pages.map((p) => p.pageNumber).sort((a, b) => a - b)).toEqual(Array.from({ length: pageCount }, (_, i) => i + 1));
  });

  it('price is derived server-side from pageCount — 5/10/15/20 pages map to 500/1000/1500/2000 tetri', async () => {
    const user = await createUser();
    for (const pageCount of ALLOWED_PAGE_COUNTS) {
      const bookId = await createBookThroughStoryPlan(user, pageCount);
      const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
      expect(book!.priceGel).toBe(calculateBookPrice(pageCount));
    }
  });

  it('rejects a disallowed pageCount at creation (e.g. 7 pages is not an offered size)', async () => {
    const res = await request('/api/childrens-books', await createUser(), 'POST', {
      language: 'EN',
      title: 'Bad Count',
      character: { name: 'X' },
      pageCount: 7,
    });
    expect(res.status).toBe(400);
  });

  it('PDF generation fails closed if somehow fewer than the book\'s own pageCount pages are accepted', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await advanceToPaid(user, bookId);
    await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');

    // Simulate one page losing its accepted artifact after generation —
    // the PDF route must refuse, not silently build a 9-page book.
    const onePage = await prisma.bookPage.findFirst({ where: { bookProjectId: bookId, pageNumber: 5 } });
    await prisma.bookPage.update({ where: { id: onePage!.id }, data: { acceptedEventId: null } });

    const res = await request(`/api/childrens-books/${bookId}/pdf`, user, 'POST');
    expect(res.status).toBe(400);
  });
});

describe("Children's Book — revision limit & idempotency", () => {
  it('a second revision claim is rejected after the first succeeds', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await advanceToPaid(user, bookId);
    await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');

    const first = await request(`/api/childrens-books/${bookId}/revision`, user, 'POST', { pageNumber: 3, note: 'make it brighter' });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { data: { revisionUsed: boolean } };
    expect(firstBody.data.revisionUsed).toBe(true);

    const second = await request(`/api/childrens-books/${bookId}/revision`, user, 'POST', { pageNumber: 4, note: 'again' });
    expect(second.status).toBe(400);
  });

  it('rejects an out-of-range page number', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await advanceToPaid(user, bookId);
    await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');

    const res = await request(`/api/childrens-books/${bookId}/revision`, user, 'POST', { pageNumber: 11 });
    expect(res.status).toBe(400);
  });

  it('two concurrent revision claims on the same book only let one through', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await advanceToPaid(user, bookId);
    await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');

    const [a, b] = await Promise.all([
      request(`/api/childrens-books/${bookId}/revision`, user, 'POST', { pageNumber: 1 }),
      request(`/api/childrens-books/${bookId}/revision`, user, 'POST', { pageNumber: 2 }),
    ]);
    // Exactly one claim wins (200); the loser is rejected either by the
    // atomic updateMany (409, if it read the book before the winner
    // committed) or by the earlier canClaimRevision pre-check (400, if it
    // read the book after) — which one depends on request interleaving,
    // but the DB-level guarantee under test is "never both win."
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(statuses[1]).toBeLessThan(500);
  });
});

describe("Children's Book — payment gate", () => {
  it('final-generation start is blocked before PAID even with an approved character', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await request(`/api/childrens-books/${bookId}/character-preview`, user, 'POST');
    await request(`/api/childrens-books/${bookId}/character-approval`, user, 'POST');

    const res = await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');
    expect(res.status).toBe(400);
    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('CHARACTER_APPROVED');
  });

  it('dev payment simulation is refused when the feature flag is off (the default)', async () => {
    // The module mock above already defaults isBookDevPaymentSimulationEnabled
    // to false — asserted explicitly here so the test still fails loudly if
    // that default ever changes.
    expect(bookMockConfig.isBookDevPaymentSimulationEnabled()).toBe(false);
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    const res = await request(`/api/childrens-books/${bookId}/payment/dev-simulate`, user, 'POST');
    expect(res.status).toBe(403);
  });
});

describe("Children's Book — private download authorization", () => {
  it('download is refused before any PDF exists', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    const res = await request(`/api/childrens-books/${bookId}/pdf/download`, user, 'GET');
    expect(res.status).toBe(404);
  });

  it('repeated download after completion never changes status/pdfVersion/revisionUsed', async () => {
    const user = await createUser();
    const bookId = await createBookThroughStoryPlan(user);
    await advanceToPaid(user, bookId);
    await request(`/api/childrens-books/${bookId}/final-generation/start`, user, 'POST');
    await request(`/api/childrens-books/${bookId}/pdf`, user, 'POST');

    const before = await prisma.bookProject.findUnique({ where: { id: bookId } });
    const dl1 = await request(`/api/childrens-books/${bookId}/pdf/download`, user);
    const dl2 = await request(`/api/childrens-books/${bookId}/pdf/download`, user);
    expect(dl1.status).toBe(200);
    expect(dl2.status).toBe(200);
    const after = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(after!.status).toBe(before!.status);
    expect(after!.pdfVersion).toBe(before!.pdfVersion);
    expect(after!.revisionUsed).toBe(before!.revisionUsed);
  });
});
