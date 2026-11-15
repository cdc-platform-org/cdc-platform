import 'express-async-errors';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import adminCms from '../admin/adminCms';
import publicContent from '../siteContent';
import { errorHandler } from '../../middleware/errorHandler';
import { aboutHubSchema } from '../../services/cms/aboutHubSchema';

const seed = JSON.parse(readFileSync(resolve(__dirname, '../../../../Frontend/src/data/aboutHubSeed.json'), 'utf8'));
let server: Server;
let url: string;
let adminToken: string;
let memberToken: string;
let original: Awaited<ReturnType<typeof prisma.siteContent.findUnique>>;
beforeAll(async () => {
  original = await prisma.siteContent.findUnique({ where: { page: 'about' } });
  const admin = await createUser({ adminRole: 'MANAGER' });
  const member = await createUser();
  const token = (user: typeof admin) => jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '5m' });
  adminToken = token(admin); memberToken = token(member);
  const app = express(); app.use(express.json()); app.use('/api/admin/cms', adminCms); app.use('/api/site-content', publicContent); app.use(errorHandler);
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (original) await prisma.siteContent.upsert({ where: { page: 'about' }, create: original, update: { content: original.content!, updatedById: original.updatedById, updatedAt: original.updatedAt } });
  else await prisma.siteContent.deleteMany({ where: { page: 'about' } });
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await prisma.$disconnect();
});
const write = (content: unknown, token = adminToken) => fetch(`${url}/api/admin/cms/about`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ content }) });

it('validates the full bilingual starter content', () => { expect(aboutHubSchema.safeParse(seed).success).toBe(true); });
it('restricts publishing to the existing CMS admin roles', async () => {
  expect((await write(seed, '')).status).toBe(401);
  expect((await write(seed, memberToken)).status).toBe(403);
});
it('publishes bilingual gallery categories and project metrics through the existing CMS API', async () => {
  const content = structuredClone(seed); content.overview.title.en = 'A reviewed editorial headline';
  content.gallery[0].category = 'workshop';
  const response = await write(content); expect(response.status).toBe(200);
  const read = await fetch(`${url}/api/site-content/about`);
  expect((await read.json() as any).data.content).toMatchObject({ overview: { title: { en: 'A reviewed editorial headline' } }, gallery: [{ category: 'workshop' }, ...content.gallery.slice(1)] });
});
it.each(['missingEnglish', 'unsafeUrl', 'badCategory', 'reversedDates', 'invalidDate', 'duplicateIds'])('rejects invalid About content without changing the published data: %s', async failure => {
  const content = structuredClone(seed);
  if (failure === 'missingEnglish') content.projects[0].title.en = '';
  if (failure === 'unsafeUrl') content.partners[0].url = 'javascript:alert(1)';
  if (failure === 'badCategory') content.gallery[0].category = 'invalid';
  if (failure === 'reversedDates') content.projects[0].endDate = '2024-01-01';
  if (failure === 'invalidDate') content.projects[0].startDate = '2025-02-31';
  if (failure === 'duplicateIds') content.gallery[1].id = content.gallery[0].id;
  expect((await write(content)).status).toBe(400);
  const row = await prisma.siteContent.findUniqueOrThrow({ where: { page: 'about' } });
  expect((row.content as any).overview.title.en).toBe('A reviewed editorial headline');
});
it('allows intentionally empty collections rather than restoring deleted examples', async () => {
  const content = { ...seed, gallery: [], projects: [], stories: [], partners: [] };
  expect((await write(content)).status).toBe(200);
  expect(((await prisma.siteContent.findUniqueOrThrow({ where: { page: 'about' } })).content as any).gallery).toEqual([]);
});
it('seeding preserves existing editorial changes and intentionally empty collections', () => {
  execFileSync(process.execPath, ['node_modules/ts-node/dist/bin.js', '--project', 'tsconfig.seed-about.json', 'scripts/seedAbout.ts'], { cwd: resolve(__dirname, '../../..'), env: process.env, timeout: 30000, stdio: 'pipe' });
}, 35000);
it('the seeded row still contains the previously saved empty gallery', async () => {
  expect(((await prisma.siteContent.findUniqueOrThrow({ where: { page: 'about' } })).content as any).gallery).toEqual([]);
});
