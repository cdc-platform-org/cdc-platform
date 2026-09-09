import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import mediaStudioRouter from '../mediaStudio';
import { errorHandler } from '../../middleware/errorHandler';
import { callTextModelPlain, AiAgentError } from '../../services/aiAgentService';

jest.mock('../../services/aiAgentService', () => ({
  callTextModelPlain: jest.fn(),
  AiAgentError: jest.requireActual('../../services/aiAgentService').AiAgentError,
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/media-studio', mediaStudioRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(callTextModelPlain).mockResolvedValue('Translated text.');
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

function request(path: string, user: User, method = 'POST', body?: unknown) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.2.${++requestNumber}`, Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Media Studio Digital Tool entitlement gate', () => {
  it('blocks an unentitled user from the real backend route', async () => {
    const stranger = await createUser();
    const response = await request('/media-studio/translate', stranger, 'POST', { text: 'hello', targetLanguage: 'Georgian' });
    expect(response.status).toBe(403);
    expect(callTextModelPlain).not.toHaveBeenCalled();
  });

  it('lets an AccessGrant holder through to the real endpoint', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const learner = await createUser();
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'media-studio', userId: learner.id, createdById: admin.id } });

    const response = await request('/media-studio/translate', learner, 'POST', { text: 'hello', targetLanguage: 'Georgian' });
    expect(response.status).toBe(200);
    expect(callTextModelPlain).toHaveBeenCalled();
  });

  it('lets an internal admin-team member through without any grant', async () => {
    const admin = await createUser({ adminRole: 'MODERATOR' });
    const response = await request('/media-studio/translate', admin, 'POST', { text: 'hello', targetLanguage: 'Georgian' });
    expect(response.status).toBe(200);
  });
});
