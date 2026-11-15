/**
 * Integration tests for the design editor API (routes/designs.ts and
 * routes/admin/adminProductTemplates.ts): purchase-gated access, template
 * validation, save/reset/delete, and the image-proxy guards.
 */
import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser, createDigitalProduct } from '../../test/factories';
import designsRouter from '../designs';
import adminTemplatesRouter from '../admin/adminProductTemplates';
import { errorHandler } from '../../middleware/errorHandler';
import sharp from 'sharp';

// In-memory stand-in for the private Azure container.
const blobs = new Map<string, Buffer>();
jest.mock('../../services/integrations/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn(async (name: string, buffer: Buffer) => { blobs.set(name, buffer); }),
  downloadPrivateBlob: jest.fn(async (name: string) => {
    const blob = blobs.get(name);
    if (!blob) throw new Error('not found');
    return blob;
  }),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));
  app.use('/designs', designsRouter);
  app.use('/admin/product-templates', adminTemplatesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.7.${++requestNumber % 250}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function body(response: Response): Promise<any> { return response.json(); }

const template = {
  format: 'cdc-template/1',
  title: 'CV',
  locale: 'ka',
  page: { widthMm: 210, heightMm: 297 },
  pages: [{
    id: 'p1',
    elements: [
      { id: 'name', type: 'text', xMm: 20, yMm: 20, wMm: 170, hMm: 15, text: 'სახელი გვარი', fontFamily: 'FiraGO', fontSizePt: 28, color: '#111111' },
      { id: 'bar', type: 'shape', shape: 'rect', xMm: 0, yMm: 0, wMm: 210, hMm: 8, fill: '#2b6cb0', locked: true, editable: false },
    ],
  }],
};

async function setup() {
  const admin = await createUser({ role: 'SuperAdmin', adminRole: 'SUPER_ADMIN', status: 'APPROVED' });
  const buyer = await createUser({ status: 'APPROVED' });
  const stranger = await createUser({ status: 'APPROVED' });
  const product = await createDigitalProduct({});
  await prisma.productPurchase.create({ data: { userId: buyer.id, productId: product.id, amount: 1000, paymentStatus: 'COMPLETED' } });
  return { admin, buyer, stranger, product };
}

describe('design editor API', () => {
  it('exports current vector edits only for the owner with an active purchase', async () => {
    const {admin,buyer,stranger,product} = await setup();
    await request(`/admin/product-templates/${product.id}`,admin,'PUT',template);
    const {id} = (await body(await request('/designs',buyer,'POST',{productId:product.id}))).data;
    const edited = structuredClone(template);
    edited.pages[0].elements[0].text = 'ჩემი ახალი ბრენდი';
    const payload = {data:edited,pageIndex:0,transparent:true};
    expect((await request(`/designs/${id}/export-svg`,stranger,'POST',payload)).status).toBe(404);
    const response = await request(`/designs/${id}/export-svg`,buyer,'POST',payload);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/svg+xml');
    expect(response.headers.get('cache-control')).toContain('no-store');
    const svg = await response.text();
    expect(svg).toContain('ჩემი ახალი ბრენდი');
    expect(svg).not.toContain('data-page-background');
    expect((await body(await request(`/designs/${id}`,buyer))).data.data.pages[0].elements[0].text).toBe('სახელი გვარი');
    expect((await request(`/designs/${id}/export-svg`,buyer,'POST',{...payload,pageIndex:9})).status).toBe(400);
    expect((await request(`/designs/${id}/export-svg`,buyer,'POST',{...payload,transparent:'true'})).status).toBe(400);
    await prisma.productPurchase.update({where:{userId_productId:{userId:buyer.id,productId:product.id}},data:{paymentStatus:'REFUNDED'}});
    expect((await request(`/designs/${id}/export-svg`,buyer,'POST',payload)).status).toBe(403);
  });
  it('lets only admins attach a valid template and rejects invalid ones', async () => {
    const { admin, buyer, product } = await setup();
    expect((await request(`/admin/product-templates/${product.id}`, buyer, 'PUT', template)).status).toBe(403);

    const bad = await request(`/admin/product-templates/${product.id}`, admin, 'PUT', {
      ...template, pages: [{ id: 'p1', elements: [{ ...template.pages[0].elements[0], fontFamily: 'Comic Sans' }] }],
    });
    expect(bad.status).toBe(400);
    expect((await body(bad)).message).toMatch(/fontFamily/);

    const ok = await request(`/admin/product-templates/${product.id}`, admin, 'PUT', template);
    expect(ok.status).toBe(200);
    const again = await request(`/admin/product-templates/${product.id}`, admin, 'PUT', template);
    expect((await body(again)).data.version).toBe(2);
  });

  it('gates designs on a completed purchase and supports save/reset/delete', async () => {
    const { admin, buyer, stranger, product } = await setup();
    await request(`/admin/product-templates/${product.id}`, admin, 'PUT', template);

    expect((await request('/designs', stranger, 'POST', { productId: product.id })).status).toBe(403);

    const listed = await body(await request('/designs/products', buyer));
    expect(listed.data.map((p: { id: string }) => p.id)).toContain(product.id);

    const created = await request('/designs', buyer, 'POST', { productId: product.id });
    expect(created.status).toBe(201);
    const { id } = (await body(created)).data;

    // Someone else can't read it — and it reads as "not found", not "forbidden".
    expect((await request(`/designs/${id}`, stranger)).status).toBe(404);

    const loaded = (await body(await request(`/designs/${id}`, buyer))).data;
    expect(loaded.data.pages[0].elements[0].text).toBe('სახელი გვარი');

    const edited = structuredClone(loaded.data);
    edited.pages[0].elements[0].text = 'ნინო ბერიძე';
    const saved = await request(`/designs/${id}`, buyer, 'PUT', { data: edited, title: 'ჩემი CV' });
    expect(saved.status).toBe(200);
    const reloaded = (await body(await request(`/designs/${id}`, buyer))).data;
    expect(reloaded.title).toBe('ჩემი CV');
    expect(reloaded.data.pages[0].elements[0].text).toBe('ნინო ბერიძე');

    // A design can't be used to store arbitrary script-y image sources.
    const evil = structuredClone(edited);
    evil.pages[0].elements.push({ id: 'img', type: 'image', xMm: 0, yMm: 0, wMm: 10, hMm: 10, src: 'javascript:alert(1)' });
    expect((await request(`/designs/${id}`, buyer, 'PUT', { data: evil })).status).toBe(400);

    const reset = (await body(await request(`/designs/${id}/reset`, buyer, 'POST'))).data;
    expect(reset.data.pages[0].elements[0].text).toBe('სახელი გვარი');

    // Refunded purchase → editor access is gone too.
    await prisma.productPurchase.update({
      where: { userId_productId: { userId: buyer.id, productId: product.id } }, data: { paymentStatus: 'REFUNDED' },
    });
    expect((await request(`/designs/${id}`, buyer)).status).toBe(403);

    expect((await request(`/designs/${id}`, buyer, 'DELETE')).status).toBe(204);
  });

  it('refuses asset refs that belong to someone else or to foreign hosts', async () => {
    const { admin, buyer, stranger, product } = await setup();
    await request(`/admin/product-templates/${product.id}`, admin, 'PUT', template);
    const { id } = (await body(await request('/designs', buyer, 'POST', { productId: product.id }))).data;

    const othersRef = `cdcdesign://design-asset-${stranger.id}-${crypto.randomUUID()}.webp`;
    expect((await request(`/designs/${id}/assets?ref=${encodeURIComponent(othersRef)}`, buyer)).status).toBe(404);
    const foreign = await request(`/designs/${id}/assets?ref=${encodeURIComponent('https://169.254.169.254/latest/meta-data')}`, buyer);
    expect(foreign.status).toBe(400);
  });

  it('stores uploads privately (re-encoded) and serves them only to their owner', async () => {
    const { admin, buyer, product } = await setup();
    await request(`/admin/product-templates/${product.id}`, admin, 'PUT', template);
    const { id } = (await body(await request('/designs', buyer, 'POST', { productId: product.id }))).data;
    const token = jwt.sign({ userId: buyer.id, role: buyer.role, email: buyer.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });

    const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#c05030' } }).jpeg().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'me.jpg');
    const uploaded = await fetch(`${baseUrl}/designs/${id}/assets`, {
      method: 'POST', body: form, headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '198.18.9.1' },
    });
    expect(uploaded.status).toBe(201);
    const { ref, width, height } = (await body(uploaded)).data;
    expect(ref).toMatch(new RegExp(`^cdcdesign://design-asset-${buyer.id}-[0-9a-f-]{36}\.webp$`));
    expect([width, height]).toEqual([64, 48]);

    const served = await request(`/designs/${id}/assets?ref=${encodeURIComponent(ref)}`, buyer);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect((await sharp(Buffer.from(await served.arrayBuffer())).metadata()).format).toBe('webp');

    // Not an image at all → rejected by sharp, nothing stored.
    const bad = new FormData();
    bad.append('image', new Blob([new Uint8Array(Buffer.from('not an image'))], { type: 'image/png' }), 'x.png');
    const badUpload = await fetch(`${baseUrl}/designs/${id}/assets`, {
      method: 'POST', body: bad, headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': '198.18.9.2' },
    });
    expect(badUpload.status).toBe(400);
  });
});
