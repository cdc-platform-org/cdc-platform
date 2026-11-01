import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import childrensBookRoutes from '../childrensBook';
import paymentsRouter from '../payments';
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/bogPaymentService';

// ============================================================
// Children's Book — optional character photo + appearance description,
// extra story characters, and the mandatory book preview before payment.
// ============================================================

jest.mock('../../services/bogPaymentService', () => ({
  ...jest.requireActual('../../services/bogPaymentService'),
  createBogOrder: jest.fn(),
}));
jest.mock('../../services/bookMockConfig', () => ({
  ...jest.requireActual('../../services/bookMockConfig'),
  isBookDevPaymentSimulationEnabled: jest.fn(() => false),
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

function authHeaders(user?: User): Record<string, string> {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return { 'X-Forwarded-For': `198.18.9.${++requestNumber}`, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path: string, user?: User, method = 'GET', body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(user) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function uploadPhoto(bookId: string, user: User, buffer: Buffer, type = 'image/png', filename = 'kid.png', consent = true) {
  const form = new FormData();
  if (consent) form.append('consent', 'true');
  form.append('photo', new Blob([new Uint8Array(buffer)], { type }), filename);
  return fetch(`${baseUrl}/api/childrens-books/${bookId}/character-photo`, { method: 'POST', headers: authHeaders(user), body: form });
}

async function samplePng(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 120, b: 80 } } })
    .withMetadata({ exif: { IFD0: { Copyright: 'secret-location' } } })
    .png()
    .toBuffer();
}

async function createBook(user: User, character: Record<string, unknown> = { name: 'Nino', age: 6 }) {
  const res = await request('/api/childrens-books', user, 'POST', { language: 'EN', title: 'Photo Adventure', character, pageCount: 5 });
  return { res, body: (await res.json()) as { data: { id: string; characterConfig: any }; message?: string } };
}

async function approve(user: User, bookId: string) {
  await request(`/api/childrens-books/${bookId}/story-plan`, user, 'POST');
  await request(`/api/childrens-books/${bookId}/character-preview`, user, 'POST');
  await request(`/api/childrens-books/${bookId}/character-approval`, user, 'POST');
}

describe("Children's Book — appearance and extra characters", () => {
  it('stores the optional appearance and extra characters, trimmed', async () => {
    const user = await createUser();
    const { res, body } = await createBook(user, { name: 'Nino', appearance: '  curly brown hair, green eyes ', extraCharacters: 'little brother Luka and a dog named Bobi' });
    expect(res.status).toBe(201);
    expect(body.data.characterConfig.appearance).toBe('curly brown hair, green eyes');
    expect(body.data.characterConfig.extraCharacters).toBe('little brother Luka and a dog named Bobi');
  });

  it('rejects an over-long appearance description', async () => {
    const user = await createUser();
    const { res } = await createBook(user, { name: 'Nino', appearance: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('never stores server-owned storage keys sent by the client', async () => {
    const user = await createUser();
    const { body } = await createBook(user, { name: 'Nino', previewImageKey: 'books/someone-else/secret.png', photoKey: 'books/x/y.jpg' });
    expect(body.data.characterConfig.previewImageKey).toBeUndefined();
    expect(body.data.characterConfig.photoKey).toBeUndefined();
  });

  it('weaves the extra characters into the story plan', async () => {
    const user = await createUser();
    const { body } = await createBook(user, { name: 'Nino', extraCharacters: 'Grandma Eteri' });
    const res = await request(`/api/childrens-books/${body.data.id}/story-plan`, user, 'POST');
    const plan = (await res.json()) as { data: { storyPlan: { pages: Array<{ storyText: string; sceneDescription: string }> } } };
    expect(plan.data.storyPlan.pages[0].storyText).toContain('Grandma Eteri');
    expect(plan.data.storyPlan.pages[3].sceneDescription).toContain('Grandma Eteri');
  });

  it('copies appearance and extra characters into the locked Character Bible', async () => {
    const user = await createUser();
    const { body } = await createBook(user, { name: 'Nino', appearance: 'red raincoat', extraCharacters: 'a cat' });
    await approve(user, body.data.id);
    const book = await prisma.bookProject.findUnique({ where: { id: body.data.id } });
    expect(book!.status).toBe('CHARACTER_APPROVED');
    expect((book!.characterBible as any).appearance).toBe('red raincoat');
    expect((book!.characterBible as any).extraCharacters).toBe('a cat');
    expect((book!.characterBible as any).useReferencePortrait).toBe(false);
  });
});

describe("Children's Book — character photo", () => {
  it('uploads, re-encodes as JPEG without metadata, and serves it back to the owner only', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const { body } = await createBook(owner);

    const up = await uploadPhoto(body.data.id, owner, await samplePng());
    expect(up.status).toBe(201);
    const uploaded = (await up.json()) as { data: { characterConfig: any } };
    expect(uploaded.data.characterConfig.photoKey).toMatch(new RegExp(`^books/${body.data.id}/character-photo-`));
    expect(uploaded.data.characterConfig.name).toBe('Nino');

    const get = await fetch(`${baseUrl}/api/childrens-books/${body.data.id}/character-photo`, { headers: authHeaders(owner) });
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toContain('image/jpeg');
    const meta = await sharp(Buffer.from(await get.arrayBuffer())).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();

    const intruderGet = await fetch(`${baseUrl}/api/childrens-books/${body.data.id}/character-photo`, { headers: authHeaders(intruder) });
    expect(intruderGet.status).toBe(404);
    const intruderUp = await uploadPhoto(body.data.id, intruder, await samplePng());
    expect(intruderUp.status).toBe(404);
  });

  it('refuses the photo without explicit parental consent', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    const res = await uploadPhoto(body.data.id, user, await samplePng(), 'image/png', 'kid.png', false);
    expect(res.status).toBe(400);
    const book = await prisma.bookProject.findUnique({ where: { id: body.data.id } });
    expect((book!.characterConfig as any).photoKey).toBeUndefined();
  });

  it('records when consent was given', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    const up = await uploadPhoto(body.data.id, user, await samplePng());
    expect(up.status).toBe(201);
    expect(((await up.json()) as any).data.characterConfig.photoConsentAt).toBeTruthy();
  });

  it('deletes the original photo as soon as the character is approved', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    await uploadPhoto(body.data.id, user, await samplePng());
    await approve(user, body.data.id);
    const book = await prisma.bookProject.findUnique({ where: { id: body.data.id } });
    expect((book!.characterBible as any).useReferencePortrait).toBe(true);
    expect((book!.characterConfig as any).photoKey).toBeUndefined();
    expect((book!.characterConfig as any).photoDeletedAt).toBeTruthy();
    const get = await fetch(`${baseUrl}/api/childrens-books/${body.data.id}/character-photo`, { headers: authHeaders(user) });
    expect(get.status).toBe(404);
  });

  it('refuses a file that is not really an image', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    const res = await uploadPhoto(body.data.id, user, Buffer.from('definitely not a png'), 'image/png');
    expect(res.status).toBe(400);
  });

  it('refuses a non-image content type', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    const res = await uploadPhoto(body.data.id, user, Buffer.from('%PDF-1.4'), 'application/pdf', 'doc.pdf');
    expect(res.status).toBe(400);
  });

  it('can be removed before approval, and is locked after approval', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    await uploadPhoto(body.data.id, user, await samplePng());

    const del = await request(`/api/childrens-books/${body.data.id}/character-photo`, user, 'DELETE');
    expect(del.status).toBe(200);
    expect(((await del.json()) as any).data.characterConfig.photoKey).toBeUndefined();

    await uploadPhoto(body.data.id, user, await samplePng());
    await approve(user, body.data.id);
    const book = await prisma.bookProject.findUnique({ where: { id: body.data.id } });
    expect((book!.characterBible as any).useReferencePortrait).toBe(true);

    const late = await uploadPhoto(body.data.id, user, await samplePng());
    expect(late.status).toBe(400);
    const lateDelete = await request(`/api/childrens-books/${body.data.id}/character-photo`, user, 'DELETE');
    expect(lateDelete.status).toBe(400);
  });

  it('lets the parent regenerate the portrait after changing the photo', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    await request(`/api/childrens-books/${body.data.id}/story-plan`, user, 'POST');
    await request(`/api/childrens-books/${body.data.id}/character-preview`, user, 'POST');
    await uploadPhoto(body.data.id, user, await samplePng());
    const again = await request(`/api/childrens-books/${body.data.id}/character-preview`, user, 'POST');
    expect(again.status).toBe(201);
    const book = await prisma.bookProject.findUnique({ where: { id: body.data.id } });
    expect(book!.status).toBe('CHARACTER_PREVIEW_READY');
    expect((book!.characterConfig as any).photoKey).toBeTruthy();
  });
});

describe("Children's Book — preview before payment", () => {
  it('checkout is refused until the preview is confirmed', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    await approve(user, body.data.id);

    const blocked = await request(`/api/payments/checkout/childrens-book/${body.data.id}`, user, 'POST', {});
    expect(blocked.status).toBe(400);
    expect(((await blocked.json()) as any).code).toBe('PREVIEW_NOT_CONFIRMED');
    expect(createBogOrder).not.toHaveBeenCalled();

    const confirm = await request(`/api/childrens-books/${body.data.id}/preview-confirm`, user, 'POST');
    expect(confirm.status).toBe(200);
    expect(((await confirm.json()) as any).data.previewConfirmedAt).toBeTruthy();

    const ok = await request(`/api/payments/checkout/childrens-book/${body.data.id}`, user, 'POST', {});
    expect(ok.status).toBe(201);
    expect(createBogOrder).toHaveBeenCalledTimes(1);
  });

  it('the preview cannot be confirmed before the character is approved', async () => {
    const user = await createUser();
    const { body } = await createBook(user);
    await request(`/api/childrens-books/${body.data.id}/story-plan`, user, 'POST');
    const res = await request(`/api/childrens-books/${body.data.id}/preview-confirm`, user, 'POST');
    expect(res.status).toBe(400);
  });

  it('only the owner can confirm the preview', async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const { body } = await createBook(owner);
    await approve(owner, body.data.id);
    const res = await request(`/api/childrens-books/${body.data.id}/preview-confirm`, intruder, 'POST');
    expect(res.status).toBe(404);
  });
});
