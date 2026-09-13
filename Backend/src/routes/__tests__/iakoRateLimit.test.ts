import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import iakoRouter from '../iako';
import adminIakoRouter from '../adminIako';
import { errorHandler } from '../../middleware/errorHandler';
import { callTextModel, isAiAgentConfigured } from '../../services/aiAgentService';

// Kept in its own file/app instance, deliberately separate from
// iako.test.ts's daily/hourly/total DB-backed quota suite — this file only
// proves the IP-vs-user KEYING of the chatLimiter (15/min) added on top of
// those quotas in routes/iako.ts, not the quota logic itself.
jest.mock('../../services/aiAgentService', () => ({
  callTextModel: jest.fn(), isAiAgentConfigured: jest.fn(),
  AiAgentError: jest.requireActual('../../services/aiAgentService').AiAgentError,
}));
jest.mock('../../services/auditLogService', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));
// iakoScreenshotService.ts imports privateBlobStorage.ts, which opens a real
// Azure Blob container handle at module-import time — mocked here purely so
// importing iakoRouter doesn't attempt a real network call, even though
// these tests never attach a screenshot.
jest.mock('../../services/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn().mockResolvedValue(undefined),
  assertPrivateBlobContainer: jest.fn().mockResolvedValue(undefined),
  privateBlobExists: jest.fn().mockResolvedValue(true),
  getSignedBlobUrl: jest.fn().mockImplementation(async (blobName: string) => `https://test-blob.example.test/${blobName}?sig=test`),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/iako', iakoRouter);
  app.use('/admin/iako', adminIakoRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isAiAgentConfigured).mockReturnValue(true);
  jest.mocked(callTextModel).mockImplementation(async (prompt: string) => {
    if (prompt.includes('strict scope classifier')) return JSON.stringify({ decision: 'IN_SCOPE' });
    if (prompt.includes('Update a running project-context summary')) return JSON.stringify({ summary: 'x' });
    return JSON.stringify({ response: 'A helpful, in-scope reply.' });
  });
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

function authHeader(user: User) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return `Bearer ${token}`;
}
async function request(path: string, user: User, method = 'GET', body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: authHeader(user) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}

// Every call explicitly sets X-Forwarded-For to a caller-chosen (or, for the
// "different IP per call" cases, auto-incrementing) address — this is what
// simulates "25 learners behind one classroom NAT" vs. "one learner whose
// apparent IP changes between requests" without needing real network
// topology in a unit/integration test.
let ipCounter = 0;
async function chatRequest(path: string, user: User, message: string, ip?: string) {
  const form = new FormData();
  form.append('message', message);
  form.append('idempotencyKey', randomUUID());
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(user), 'X-Forwarded-For': ip ?? `198.51.100.${(++ipCounter % 250) + 1}` },
    body: form,
  });
}

async function createProfile(admin: User) {
  const response = await request('/admin/iako/profiles', admin, 'POST', {
    // High defaults so the DB-backed hourly/daily/total quota (proven
    // elsewhere in iako.test.ts) never interferes with isolating the
    // in-memory chatLimiter's own 15/min ceiling in these tests.
    name: 'Rate-limit fixture assistant', systemPrompt: 'You are a helpful assistant.',
    inScope: 'Anything.', outOfScopeKeywords: [], visionEnabled: false, temperature: 0.2, active: true,
    defaultRequestLimit: 1000, defaultDailyRequestLimit: 1000, defaultHourlyRequestLimit: 1000,
  });
  return data<{ id: string }>(response);
}
// A dedicated Digital Tool key, distinct from the ones iako.test.ts's much
// larger suite reuses throughout, so this file's fixtures never depend on
// (or race with) that file's assignment state for the same key.
const TOOL_KEY = 'chatbot-builder';
async function assignedProfile(admin: User) {
  const profile = await createProfile(admin);
  await request(`/admin/iako/assignments/digital-tool/${TOOL_KEY}`, admin, 'PUT', { profileId: profile.id });
  return profile;
}
async function entitledLearner(admin: User) {
  const learner = await createUser();
  await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: TOOL_KEY, userId: learner.id, createdById: admin.id } });
  return learner;
}

describe('IAKO chat rate limiter — per-user, not per-IP', () => {
  it('two different authenticated users behind the same apparent IP do not share the 15/min bucket', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin);
    const learnerA = await entitledLearner(admin);
    const learnerB = await entitledLearner(admin);
    const sharedIp = '203.0.113.50';

    // Exhaust learner A's own 15/min bucket, all from the shared IP.
    for (let i = 1; i <= 15; i++) {
      const response = await chatRequest(`/iako/digital-tool/${TOOL_KEY}/chat`, learnerA, `A question ${i}`, sharedIp);
      expect(response.status).toBe(200);
    }
    // Self-check: A's own 16th request from that same IP is now limited —
    // proves the bucket really is exhausted, not just untriggered.
    const aBlocked = await chatRequest(`/iako/digital-tool/${TOOL_KEY}/chat`, learnerA, 'A question 16', sharedIp);
    expect(aBlocked.status).toBe(429);

    // Learner B, first request ever, from the exact same shared IP — must
    // NOT inherit A's exhausted bucket. Under the old req.ip-keyed limiter
    // this would have been the 17th hit on one shared bucket and returned
    // 429; keyed by user id it must succeed.
    const bResponse = await chatRequest(`/iako/digital-tool/${TOOL_KEY}/chat`, learnerB, 'B question 1', sharedIp);
    expect(bResponse.status).toBe(200);
  });

  it('one authenticated user exceeding 15 requests/minute receives 429, even across changing IPs', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin);
    const learner = await entitledLearner(admin);

    // Deliberately a DIFFERENT apparent IP on every call (the default
    // chatRequest behavior) — proves the limiter follows the authenticated
    // user, not whatever IP a given request happens to arrive from.
    for (let i = 1; i <= 15; i++) {
      const response = await chatRequest(`/iako/digital-tool/${TOOL_KEY}/chat`, learner, `Question ${i}`);
      expect(response.status).toBe(200);
    }
    const sixteenth = await chatRequest(`/iako/digital-tool/${TOOL_KEY}/chat`, learner, 'Question 16');
    expect(sixteenth.status).toBe(429);
    const body = await sixteenth.json() as { message: string };
    // The generic chatLimiter message, not the DB-quota IakoUsageError's
    // canned "your IAKO access limit" text — confirms this 429 came from the
    // in-memory rate limiter and not from a coincidentally-reached DB quota.
    expect(body.message).toMatch(/too many requests/i);
    // Exactly 15 real answers were generated (not 16) — the blocked request
    // never reached the model at all. Filtered by prompt marker rather than
    // a raw call count, since a long-enough thread also triggers a separate
    // summary-maintenance call to the same mock (see iako.test.ts's
    // "IAKO conversation summary" suite) — irrelevant to what this test is
    // proving and not something this file should have to track.
    const answerCalls = jest.mocked(callTextModel).mock.calls.filter(([prompt]) => prompt.includes('Context priority when answering'));
    expect(answerCalls).toHaveLength(15);
  });
});
