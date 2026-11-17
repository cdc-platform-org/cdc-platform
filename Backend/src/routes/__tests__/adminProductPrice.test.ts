import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

jest.mock('../../lib/prisma', () => ({ prisma: {
  user: { findUnique: jest.fn() }, digitalProduct: { findUnique: jest.fn(), update: jest.fn() },
} }));
jest.mock('../../services/account/auditLogService', () => ({ logAdminAction: jest.fn() }));
jest.mock('../../services/integrations/imageStorage', () => ({ uploadImage: jest.fn() }));
jest.mock('../../services/marketplace/productFileDelivery', () => ({ uploadProductFile: jest.fn(), resolveProductFileDeliveryUrl: jest.fn() }));
jest.mock('../../services/marketplace/productImageProtection', () => ({ protectProductPreviewImage: jest.fn() }));
jest.mock('../../services/ai/aiTranslateService', () => ({ autoTranslateIfBlank: jest.fn(async () => ({ titleEn: 'Title', descriptionEn: 'Description' })) }));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { logAdminAction } from '../../services/account/auditLogService';
import router from '../admin/adminProducts';

const db = prisma as any;
const token = jwt.sign({ userId: 'admin', email: 'admin@example.test', role: 'SuperAdmin' }, JWT_SECRET);
let server: Server;
let base: string;
let stored: any;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/admin/products', router);
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/products/product`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => {
  jest.clearAllMocks();
  stored = { id: 'product', title: 'Title', description: 'Description', titleEn: 'Title', descriptionEn: 'Description', price: 100, discountedPrice: null, saleStartsAt: null, saleEndsAt: null };
  db.user.findUnique.mockResolvedValue({ adminRole: 'SUPER_ADMIN', isBanned: false, deletionRequestedAt: null });
  db.digitalProduct.findUnique.mockImplementation(async () => ({ ...stored }));
  db.digitalProduct.update.mockImplementation(async ({ data }: any) => { stored = { ...stored, ...data }; return stored; });
});
const update = (body: unknown, authenticated = true) => fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

test.each([0, 100, 1999, 2147483647])('updates integer tetri %s without multiplying twice', async (priceMinor) => {
  const response = await update({ priceMinor });
  expect(response.status).toBe(200);
  const payload = await response.json() as { data: { price: number; currentPrice: number } };
  expect(payload.data.price).toBe(priceMinor);
  expect(payload.data.currentPrice).toBe(priceMinor);
  expect(stored.price).toBe(priceMinor);
});
test.each([-1, 1.5, null, '100', true, 2147483648, NaN, Infinity])('rejects invalid tetri %s before writing', async (priceMinor) => {
  expect((await update({ priceMinor })).status).toBe(400);
  expect(db.digitalProduct.update).not.toHaveBeenCalled();
});
test('preserves legacy GEL updates and audits the actual stored price', async () => {
  expect((await update({ price: 1.01 })).status).toBe(200);
  expect(stored.price).toBe(101);
  expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'products.updatePricing', metadata: expect.objectContaining({ price: { from: 100, to: 101 } }) }));
});
test.each([{ price: -1 }, { price: Infinity }, { price: 21474836.48 }, { price: 1, priceMinor: 100 }])('rejects invalid or ambiguous price payload %s', async (body) => {
  expect((await update(body)).status).toBe(400);
  expect(db.digitalProduct.update).not.toHaveBeenCalled();
});
test('leaves price unchanged when omitted', async () => {
  expect((await update({ title: 'New title' })).status).toBe(200);
  expect(stored.price).toBe(100);
});
test('retains discount validation when changing the base price', async () => {
  stored.price = 1000; stored.discountedPrice = 500;
  expect((await update({ priceMinor: 400 })).status).toBe(400);
  expect(db.digitalProduct.update).not.toHaveBeenCalled();
});
test('requires admin authorization', async () => {
  expect((await update({ priceMinor: 1999 }, false)).status).toBe(401);
  db.user.findUnique.mockResolvedValue({ adminRole: null });
  expect((await update({ priceMinor: 1999 })).status).toBe(403);
});

test('MANAGER cannot change a price and never sees one', async () => {
  db.user.findUnique.mockResolvedValue({ adminRole: 'MANAGER', isBanned: false, deletionRequestedAt: null });
  const response = await update({ priceMinor: 1, title: 'Renamed' });
  expect(response.status).toBe(200);
  expect(stored.price).toBe(100);
  const payload = await response.json() as { data: Record<string, unknown> };
  expect(payload.data.price).toBeUndefined();
  expect(payload.data.currentPrice).toBeUndefined();
  expect(payload.data.title).toBe('Renamed');
});
