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
import { AzureSpeechError } from '../../services/azureSpeechService';

// Counts provider calls so the tests can assert which pages were (re)synthesized.
const mockGenerate = jest.fn();
jest.mock('../../services/bookNarrationProviders', () => ({
  getBookNarrationProvider: () => ({ generatePageNarration: (...args: unknown[]) => mockGenerate(...args) }),
}));
jest.mock('../../services/bookStorageService', () => ({
  ...jest.requireActual('../../services/bookStorageService'),
  storeBookAsset: jest.fn(async () => undefined),
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

beforeEach(() => {
  mockGenerate.mockReset();
  mockGenerate.mockImplementation(async (input: { bookProjectId: string; pageNumber: number; revisionVersion?: number; language: string }) => ({
    buffer: Buffer.from('mp3'),
    mimeType: 'audio/mpeg',
    storageKey: `books/${input.bookProjectId}/narration/p${input.pageNumber}-${input.revisionVersion ?? 0}.mp3`,
    language: input.language,
    artifactKey: `${input.bookProjectId}:page:${input.pageNumber}:${input.revisionVersion ?? 0}`,
  }));
});

async function request(path: string, user: User, method = 'GET', body?: unknown) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.9.${++requestNumber}`, Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createPaidAudioBook(user: User) {
  const createRes = await request('/api/childrens-books', user, 'POST', {
    language: 'EN',
    title: 'Audio Adventure',
    character: { name: 'Mimi', age: 5, traits: ['brave'] },
    pageCount: 5,
    audioAddOnPurchased: true,
  });
  const { data: book } = (await createRes.json()) as { data: { id: string } };
  await request(`/api/childrens-books/${book.id}/story-plan`, user, 'POST');
  await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'PAYMENT_PENDING', audioAddOnPurchased: true } });
  await prisma.bookProject.update({ where: { id: book.id }, data: { status: 'PAID' } });
  await prisma.bookPage.updateMany({ where: { bookProjectId: book.id }, data: { storyText: 'Once upon a time.' } });
  return book.id;
}

const calledPages = () => mockGenerate.mock.calls.map(([input]) => (input as { pageNumber: number }).pageNumber).sort();

describe('Children’s Book — audio/generate skips finished pages', () => {
  it('narrates every page the first time and nothing on a repeat call', async () => {
    const user = await createUser();
    const bookId = await createPaidAudioBook(user);

    const first = await request(`/api/childrens-books/${bookId}/audio/generate`, user, 'POST');
    expect(first.status).toBe(201);
    expect(mockGenerate).toHaveBeenCalledTimes(5);

    mockGenerate.mockClear();
    const second = await request(`/api/childrens-books/${bookId}/audio/generate`, user, 'POST');
    expect(second.status).toBe(201);
    const body = (await second.json()) as { data: { skippedPages: number; artifacts: unknown[] } };
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(body.data.skippedPages).toBe(5);
    expect(body.data.artifacts).toHaveLength(0);
  });

  it('resumes after a mid-book failure and only synthesizes the missing pages', async () => {
    const user = await createUser();
    const bookId = await createPaidAudioBook(user);

    mockGenerate.mockImplementationOnce(mockGenerate.getMockImplementation()!);
    mockGenerate.mockImplementationOnce(mockGenerate.getMockImplementation()!);
    mockGenerate.mockRejectedValueOnce(new AzureSpeechError('Azure rate limited', 429));
    const failed = await request(`/api/childrens-books/${bookId}/audio/generate`, user, 'POST');
    expect(failed.status).toBe(429);
    expect(await prisma.bookNarrationArtifact.count({ where: { bookProjectId: bookId, status: 'READY' } })).toBe(2);

    mockGenerate.mockClear();
    const retry = await request(`/api/childrens-books/${bookId}/audio/generate`, user, 'POST');
    expect(retry.status).toBe(201);
    expect(calledPages()).toEqual([3, 4, 5]);
    expect(await prisma.bookNarrationArtifact.count({ where: { bookProjectId: bookId, status: 'READY' } })).toBe(5);
  });
});

describe('Children’s Book — audio/revision regenerates', () => {
  it('re-synthesizes a single page when pageNumber is given', async () => {
    const user = await createUser();
    const bookId = await createPaidAudioBook(user);
    await request(`/api/childrens-books/${bookId}/audio/generate`, user, 'POST');

    mockGenerate.mockClear();
    const res = await request(`/api/childrens-books/${bookId}/audio/revision`, user, 'POST', { pageNumber: 2 });
    expect(res.status).toBe(201);
    expect(calledPages()).toEqual([2]);
    const artifact = await prisma.bookNarrationArtifact.findFirst({ where: { bookProjectId: bookId, pageNumber: 2 } });
    expect(artifact?.attemptCount).toBe(2);
  });

  it('re-synthesizes the whole book when no pageNumber is given', async () => {
    const user = await createUser();
    const bookId = await createPaidAudioBook(user);
    await request(`/api/childrens-books/${bookId}/audio/generate`, user, 'POST');

    mockGenerate.mockClear();
    const res = await request(`/api/childrens-books/${bookId}/audio/revision`, user, 'POST', {});
    expect(res.status).toBe(201);
    expect(calledPages()).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejects an out-of-range pageNumber', async () => {
    const user = await createUser();
    const bookId = await createPaidAudioBook(user);
    const res = await request(`/api/childrens-books/${bookId}/audio/revision`, user, 'POST', { pageNumber: 99 });
    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
