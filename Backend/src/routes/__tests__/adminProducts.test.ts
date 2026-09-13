import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import adminProductsRouter from '../adminProducts';
import productsRouter from '../products';
import aiRouter from '../ai';
import { errorHandler } from '../../middleware/errorHandler';
import { callTextModel, isAiAgentConfigured } from '../../services/aiAgentService';

jest.mock('../../services/aiAgentService', () => ({ callTextModel: jest.fn(), isAiAgentConfigured: jest.fn() }));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/admin/products', adminProductsRouter);
  app.use('/products', productsRouter);
  app.use('/ai', aiRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isAiAgentConfigured).mockReturnValue(true);
  // A default, always-valid response for the best-effort auto-translate-on-
  // save path (autoTranslateIfBlank) that most tests below don't care about
  // — individual tests override this when they actually assert on a
  // translation result or failure.
  jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ titleEn: 'Auto EN Title', descriptionEn: 'Auto EN description.' }));
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.2.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}

function productInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'ციფრული პროდუქტი', description: 'პროდუქტის აღწერა ქართულად.',
    price: 1000, category: 'Templates', imageUrl: 'https://cdn.example.test/cover.png', fileUrl: 'https://cdn.example.test/file.zip',
    ...overrides,
  };
}

describe('Digital Store product bilingual title/description', () => {
  it('an admin can create a product with explicit titleEn/descriptionEn, and they round-trip through admin list/detail', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const created = await data<{ id: string; titleEn: string | null; descriptionEn: string | null }>(
      await request('/admin/products', admin, 'POST', productInput({ titleEn: 'Digital Product', descriptionEn: 'Product description in English.' }))
    );
    expect(created.titleEn).toBe('Digital Product');
    expect(created.descriptionEn).toBe('Product description in English.');

    const listed = await data<Array<{ id: string; titleEn: string | null }>>(await request('/admin/products', admin));
    expect(listed.find((p) => p.id === created.id)?.titleEn).toBe('Digital Product');
  });

  it('an admin can update an existing product\'s titleEn/descriptionEn independently of the Georgian fields', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const created = await data<{ id: string }>(await request('/admin/products', admin, 'POST', productInput()));
    const updated = await data<{ titleEn: string | null; descriptionEn: string | null; title: string }>(
      await request(`/admin/products/${created.id}`, admin, 'PUT', { titleEn: 'Updated EN Title', descriptionEn: 'Updated EN description.' })
    );
    expect(updated.titleEn).toBe('Updated EN Title');
    expect(updated.descriptionEn).toBe('Updated EN description.');
    expect(updated.title).toBe('ციფრული პროდუქტი'); // untouched.
  });

  it('the public catalog and detail routes return titleEn/descriptionEn/howItWorksSteps (regression: these were previously stripped)', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const created = await data<{ id: string }>(await request('/admin/products', admin, 'POST', productInput({ titleEn: 'Public EN Title', descriptionEn: 'Public EN description.' })));
    await prisma.digitalProduct.update({ where: { id: created.id }, data: { status: 'APPROVED' } });

    const listed = await data<Array<{ id: string; titleEn: string | null; descriptionEn: string | null }>>(await request('/products'));
    const listedProduct = listed.find((p) => p.id === created.id)!;
    expect(listedProduct.titleEn).toBe('Public EN Title');
    expect(listedProduct.descriptionEn).toBe('Public EN description.');

    const detail = await data<{ titleEn: string | null; descriptionEn: string | null }>(await request(`/products/${created.id}`));
    expect(detail.titleEn).toBe('Public EN Title');
    expect(detail.descriptionEn).toBe('Public EN description.');
  });

  it('a product with no English content falls back gracefully (titleEn/descriptionEn are null, never blank/broken)', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    // autoTranslateIfBlank (the automatic, best-effort save-time translator —
    // distinct from the manual button endpoint tested elsewhere here) is
    // gated on GEMINI_API_KEY being set, which the test env always has
    // (a dummy key); a rejected callTextModel exercises its "leave the
    // fields exactly as given" catch branch instead.
    jest.mocked(callTextModel).mockRejectedValue(new Error('Gemini request failed: 503'));
    const created = await data<{ id: string; titleEn: string | null; descriptionEn: string | null }>(await request('/admin/products', admin, 'POST', productInput()));
    expect(created.titleEn).toBeNull();
    expect(created.descriptionEn).toBeNull();
    await prisma.digitalProduct.update({ where: { id: created.id }, data: { status: 'APPROVED' } });
    const detail = await data<{ titleEn: string | null }>(await request(`/products/${created.id}`));
    expect(detail.titleEn).toBeNull();
  });

  it('the manual "Auto Translate to English" endpoint returns a translation without saving it, and does not require an existing product', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ titleEn: 'Translated Title', descriptionEn: 'Translated description.' }));
    const result = await data<{ titleEn: string; descriptionEn: string }>(
      await request('/ai/translate-title-description', admin, 'POST', { title: 'ქართული სათაური', description: 'ქართული აღწერა.' })
    );
    expect(result).toEqual({ titleEn: 'Translated Title', descriptionEn: 'Translated description.' });
    expect(callTextModel).toHaveBeenCalledTimes(1);
  });

  it('accepts exactly 15 showcase images and rejects a 16th, on both create and update', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://cdn.example.test/shot-${i}.png`);

    const ok = await request('/admin/products', admin, 'POST', productInput({ previewImages: urls(15) }));
    expect(ok.status).toBe(201);
    const created = await data<{ id: string; previewImages: string[] }>(ok);
    expect(created.previewImages).toHaveLength(15);

    const tooMany = await request('/admin/products', admin, 'POST', productInput({ previewImages: urls(16) }));
    expect(tooMany.status).toBe(400);

    const updateOk = await request(`/admin/products/${created.id}`, admin, 'PUT', { previewImages: urls(15) });
    expect(updateOk.status).toBe(200);
    const updateTooMany = await request(`/admin/products/${created.id}`, admin, 'PUT', { previewImages: urls(16) });
    expect(updateTooMany.status).toBe(400);
  });

  it('a product with 0-4 images (the old cap) still saves and round-trips normally under the new limit', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const created = await data<{ previewImages: string[] }>(await request('/admin/products', admin, 'POST', productInput({ previewImages: ['https://cdn.example.test/one.png'] })));
    expect(created.previewImages).toEqual(['https://cdn.example.test/one.png']);
  });

  it('a non-admin cannot call the translate endpoint or create a product', async () => {
    const learner = await createUser();
    expect((await request('/ai/translate-title-description', learner, 'POST', { title: 'x', description: 'y' })).status).toBe(403);
    expect((await request('/admin/products', learner, 'POST', productInput())).status).toBe(403);
  });

  it('a translation failure leaves any existing titleEn/descriptionEn on the product untouched', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const created = await data<{ id: string; titleEn: string | null }>(await request('/admin/products', admin, 'POST', productInput({ titleEn: 'Original EN Title', descriptionEn: 'Original EN description.' })));

    jest.mocked(callTextModel).mockRejectedValue(new Error('Gemini request failed: 503'));
    const translateResponse = await request('/ai/translate-title-description', admin, 'POST', { title: 'ახალი სათაური', description: 'ახალი აღწერა.' });
    expect(translateResponse.status).toBeGreaterThanOrEqual(500);

    // The endpoint never writes to the DB itself — confirm the product's
    // stored titleEn is exactly as it was before the failed translate call.
    const list = await data<Array<{ id: string; titleEn: string | null }>>(await request('/admin/products', admin));
    expect(list.find((p) => p.id === created.id)?.titleEn).toBe('Original EN Title');
  });
});
