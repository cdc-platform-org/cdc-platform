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
import {
  bookGenerationTiming,
  recoverStalledBooks,
  startFinalGeneration,
  waitForFinalGeneration,
} from '../../services/bookFinalGenerationService';

// Every image call goes through this mock: by default it returns the real
// mock-mode placeholder, and a test queues failures in front of it.
const queuedFailures: string[] = [];
const imageCalls: string[] = [];
jest.mock('../../services/bookImageGenerationService', () => {
  const actual = jest.requireActual('../../services/bookImageGenerationService');
  return {
    ...actual,
    generateBookImage: jest.fn(async (params: { prompt: string }) => {
      imageCalls.push(params.prompt);
      const failure = queuedFailures.shift();
      if (failure) {
        return { success: false, deployment: 'test', latencyMs: 1, requestId: null, httpStatus: 429, errorClassification: failure, safeErrorMessage: failure };
      }
      return actual.generateBookImage(params);
    }),
  };
});

const narrationCalls: number[] = [];
jest.mock('../../services/bookNarrationProviders', () => ({
  getBookNarrationProvider: () => ({
    generatePageNarration: async (input: { bookProjectId: string; pageNumber: number; revisionVersion?: number; language: string }) => {
      narrationCalls.push(input.pageNumber);
      return {
        buffer: Buffer.from('mp3'),
        mimeType: 'audio/mpeg',
        storageKey: `books/${input.bookProjectId}/narration/p${input.pageNumber}.mp3`,
        language: input.language,
        artifactKey: `${input.bookProjectId}:page:${input.pageNumber}:0`,
      };
    },
  }),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;
const sleeps: number[] = [];
const originalSleep = bookGenerationTiming.sleep;

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
  bookGenerationTiming.sleep = async (ms: number) => {
    sleeps.push(ms);
  };
});

afterAll(async () => {
  bookGenerationTiming.sleep = originalSleep;
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

beforeEach(() => {
  queuedFailures.length = 0;
  imageCalls.length = 0;
  narrationCalls.length = 0;
  sleeps.length = 0;
});

async function request(path: string, user: User, method = 'GET', body?: unknown) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.11.${++requestNumber}`, Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createPaidBook(user: User, opts: { audio?: boolean } = {}) {
  const createRes = await request('/api/childrens-books', user, 'POST', {
    language: 'EN',
    title: 'Recovery Adventure',
    character: { name: 'Mimi', age: 5, traits: ['brave'] },
    pageCount: 5,
    audioAddOnPurchased: !!opts.audio,
  });
  const { data: book } = (await createRes.json()) as { data: { id: string } };
  await request(`/api/childrens-books/${book.id}/story-plan`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/story-text/approve`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-preview`, user, 'POST');
  await request(`/api/childrens-books/${book.id}/character-approval`, user, 'POST');
  await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'PAYMENT_PENDING' } });
  await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'PAID' } });
  imageCalls.length = 0;
  return book.id;
}

describe("Children's Book — final generation recovers on its own", () => {
  it('retries a rate-limited page with a back-off and finishes the book (PDF included) without any click', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user);
    queuedFailures.push('QUOTA_OR_RATE_LIMIT', 'QUOTA_OR_RATE_LIMIT');

    expect(await startFinalGeneration(bookId)).toBe('STARTED');
    await waitForFinalGeneration(bookId);

    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('COMPLETED');
    expect(book!.pdfStatus).toBe('CURRENT');
    expect(sleeps).toEqual([30_000, 60_000]);
    expect(imageCalls).toHaveLength(5 + 2);
  });

  it('a page that fails a whole round is retried in an automatic second round while the book stays generating', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user);
    queuedFailures.push('AZURE_SERVICE', 'AZURE_SERVICE', 'AZURE_SERVICE');

    await startFinalGeneration(bookId);
    await waitForFinalGeneration(bookId);

    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('COMPLETED');
    expect(sleeps).toContain(60_000); // the pause before round 2
  });

  it('a content-filter refusal is retried with a softened prompt', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user);
    queuedFailures.push('CONTENT_FILTER');

    await startFinalGeneration(bookId);
    await waitForFinalGeneration(bookId);

    expect(imageCalls[0]).not.toContain('family-friendly');
    expect(imageCalls[1]).toContain('family-friendly');
    expect((await prisma.bookProject.findUnique({ where: { id: bookId } }))!.status).toBe('COMPLETED');
  });

  it('a configuration error stops at once (no paid retries) and the book waits for the recovery sweep', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user);
    queuedFailures.push('AUTHENTICATION_OR_ACCESS');

    await startFinalGeneration(bookId);
    await waitForFinalGeneration(bookId);

    expect(imageCalls).toHaveLength(1);
    const failed = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(failed!.status).toBe('FAILED');

    // Once the problem is gone the sweep restarts it, no click needed.
    const sweep = await recoverStalledBooks();
    expect(sweep.restarted).toBeGreaterThanOrEqual(1);
    await waitForFinalGeneration(bookId);
    expect((await prisma.bookProject.findUnique({ where: { id: bookId } }))!.status).toBe('COMPLETED');
  });

  it('never exceeds the per-book attempt budget, and the sweep leaves an exhausted book alone', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user);
    queuedFailures.push(...Array(200).fill('AZURE_SERVICE'));

    await startFinalGeneration(bookId);
    await waitForFinalGeneration(bookId);

    const events = await prisma.bookGenerationEvent.count({ where: { bookProjectId: bookId, operationType: 'FINAL_PAGE' } });
    expect(events).toBe(5 * 4);
    expect((await prisma.bookProject.findUnique({ where: { id: bookId } }))!.status).toBe('FAILED');

    imageCalls.length = 0;
    await recoverStalledBooks();
    await waitForFinalGeneration(bookId);
    expect(imageCalls).toHaveLength(0);
    queuedFailures.length = 0;
  });

  it('narrates every page automatically when the audio add-on was bought', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user, { audio: true });

    await startFinalGeneration(bookId);
    await waitForFinalGeneration(bookId);

    const ready = await prisma.bookNarrationArtifact.count({ where: { bookProjectId: bookId, status: 'READY' } });
    expect(ready).toBe(5);
    expect(narrationCalls.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('the sweep finishes an older ready book that never got its PDF or narration', async () => {
    const user = await createUser();
    const bookId = await createPaidBook(user, { audio: true });
    await startFinalGeneration(bookId);
    await waitForFinalGeneration(bookId);
    // Simulate a book finished before automatic finishing existed.
    await prisma.bookNarrationArtifact.deleteMany({ where: { bookProjectId: bookId } });
    await prisma.bookProject.update({ where: { id: bookId }, data: { status: 'FINAL_READY', pdfStatus: 'NONE', finalPdfBlobRef: null } });
    narrationCalls.length = 0;

    await recoverStalledBooks();

    const book = await prisma.bookProject.findUnique({ where: { id: bookId } });
    expect(book!.status).toBe('COMPLETED');
    expect(book!.pdfStatus).toBe('CURRENT');
    expect(narrationCalls).toHaveLength(5);
  });
});

describe("Children's Book — style picker samples", () => {
  it('draws a style sample once, then serves it from storage without another image call', async () => {
    const first = await fetch(`${baseUrl}/api/childrens-books/style-samples/CARTOON`);
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toContain('image/webp');
    const callsAfterFirst = imageCalls.length;
    expect(callsAfterFirst).toBeLessThanOrEqual(1);

    const second = await fetch(`${baseUrl}/api/childrens-books/style-samples/CARTOON`);
    expect(second.status).toBe(200);
    expect(imageCalls.length).toBe(callsAfterFirst);
  });

  it('404s an unknown style without any image call', async () => {
    const res = await fetch(`${baseUrl}/api/childrens-books/style-samples/NOPE`);
    expect(res.status).toBe(404);
    expect(imageCalls).toHaveLength(0);
  });
});
