// Employer verification gate: publishing a NEW job post (gig/vacancy, incl.
// draft -> open) or sending a paid direct offer needs an approved
// verification; admins bypass; already-open listings stay editable.
import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

jest.mock('../../lib/prisma', () => ({ prisma: {
  user: { findUnique: jest.fn() },
  vacancy: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), count: jest.fn() },
  gig: { create: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
  directOffer: { create: jest.fn() },
} }));
jest.mock('../../services/marketplace/postingLimitService', () => ({ hasReachedDailyPostLimit: jest.fn(async () => false) }));
jest.mock('../../services/integrations/emailService', () => ({}));

import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import gigsRouter from '../gigs';
import vacanciesRouter from '../vacancies';
import directOffersRouter from '../directOffers';

const db = prisma as any;
const tokenFor = (role: string) => jwt.sign({ userId: 'u1', email: 'u1@example.test', role }, JWT_SECRET);
let server: Server;
let base: string;

const unverified = { status: 'APPROVED', isBanned: false, deletionRequestedAt: null, isVerifiedGraduate: false, verificationLevel: 'NONE', verificationStatus: 'NONE', isVerified: false, adminRole: null };

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/gigs', gigsRouter);
  app.use('/api/vacancies', vacanciesRouter);
  app.use('/api/direct-offers', directOffersRouter);
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => {
  jest.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ ...unverified });
});

const call = (method: string, path: string, body: unknown, role = 'Client') =>
  fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(role)}` }, body: JSON.stringify(body) });

test.each([
  ['POST', '/gigs'],
  ['POST', '/vacancies'],
  ['POST', '/direct-offers'],
])('unverified employer gets a clear 403 on %s %s', async (method, path) => {
  const res = await call(method, path, {});
  expect(res.status).toBe(403);
  const body = await res.json() as Record<string, string>;
  expect(body.code).toBe('EMPLOYER_VERIFICATION_REQUIRED');
  expect(body.verifyUrl).toBe('/employer-verification');
  expect(body.messageKa).toContain('დამსაქმებლის ვერიფიკაცია');
  expect(body.message).toContain('Account verification is required');
  expect(db.gig.create).not.toHaveBeenCalled();
  expect(db.vacancy.create).not.toHaveBeenCalled();
  expect(db.directOffer.create).not.toHaveBeenCalled();
});

test.each([
  ['business', { isVerified: true, verificationLevel: 'BUSINESS', verificationStatus: 'APPROVED' }],
  ['individual', { verificationLevel: 'INDIVIDUAL', verificationStatus: 'APPROVED' }],
  ['admin-team member', { adminRole: 'MANAGER' }],
])('%s passes the gate (request then reaches validation)', async (_label, extra) => {
  db.user.findUnique.mockResolvedValue({ ...unverified, ...extra });
  for (const path of ['/gigs', '/vacancies', '/direct-offers']) {
    const res = await call('POST', path, {});
    expect(res.status).toBe(400); // schema rejects the empty body — gate passed
  }
});

test('marketplace SuperAdmin bypasses the gate', async () => {
  const res = await call('POST', '/gigs', {}, 'SuperAdmin');
  expect(res.status).toBe(400);
});

test('publishing a draft vacancy is gated; editing an open one is not', async () => {
  db.vacancy.update.mockResolvedValue({ id: 'v1' });
  db.vacancy.findUnique.mockResolvedValue({ id: 'v1', postedById: 'u1', status: 'draft' });
  const publish = await call('PUT', '/vacancies/v1', { status: 'open' });
  expect(publish.status).toBe(403);
  expect(db.vacancy.update).not.toHaveBeenCalled();

  db.vacancy.findUnique.mockResolvedValue({ id: 'v1', postedById: 'u1', status: 'open' });
  const edit = await call('PUT', '/vacancies/v1', { title: 'Senior designer (updated)' });
  expect(edit.status).toBe(200);
  expect(db.vacancy.update).toHaveBeenCalled();
});
