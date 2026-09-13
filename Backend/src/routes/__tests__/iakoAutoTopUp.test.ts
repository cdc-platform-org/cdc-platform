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
import { callTextModel, isAiAgentConfigured, AiAgentError } from '../../services/aiAgentService';

// ============================================================
// IAKO controlled auto-top-up — Monday's Vibe Coding training policy is
// 200 -> automatic +200 (once) -> 400 hard ceiling. Every test here uses a
// scaled-down equivalent (e.g. 1 -> +1 -> 2) so a real threshold crossing
// takes 1-2 real chat requests instead of 200, while exercising the exact
// same code path (iakoUsageGrantService.ts's applyAutoTopUpIfEligible).
//
// Deliberately LIVE_TRAINING-scoped (not the shared 'educator-hub'/
// 'media-studio' Digital Tool keys other test files reuse): every test
// creates its own brand-new LiveTraining row, so an assignment's top-up
// policy can never leak across tests or files the way it would on a
// shared, fixed digitalToolKey.
// ============================================================

jest.mock('../../services/aiAgentService', () => ({
  callTextModel: jest.fn(), isAiAgentConfigured: jest.fn(),
  AiAgentError: jest.requireActual('../../services/aiAgentService').AiAgentError,
}));
jest.mock('../../services/auditLogService', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/imageStorage', () => ({ uploadImage: jest.fn().mockResolvedValue('https://cdn.example.test/iako-screenshots/shot.png') }));
jest.mock('../../services/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn().mockResolvedValue(undefined),
  assertPrivateBlobContainer: jest.fn().mockResolvedValue(undefined),
  privateBlobExists: jest.fn().mockResolvedValue(true),
  getSignedBlobUrl: jest.fn().mockImplementation(async (blobName: string) => `https://test-blob.example.test/${blobName}?sig=test`),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

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
  mockAiResponses('IN_SCOPE');
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

function mockAiResponses(decision: 'IN_SCOPE' | 'OUT_OF_SCOPE' | 'AMBIGUOUS', reply = 'A helpful, in-scope reply.') {
  jest.mocked(callTextModel).mockImplementation(async (prompt: string) => {
    if (prompt.includes('strict scope classifier')) return JSON.stringify({ decision });
    if (prompt.includes('Update a running project-context summary')) return JSON.stringify({ summary: 'Learner is building a Task Manager app.' });
    return JSON.stringify({ response: reply });
  });
}

function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.3.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}
async function chatRequest(path: string, user: User, message: string, opts: { idempotencyKey?: string } = {}) {
  const form = new FormData();
  form.append('message', message);
  form.append('idempotencyKey', opts.idempotencyKey ?? randomUUID());
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': `198.18.3.${++requestNumber}` }, body: form });
}

async function createProfile(admin: User, overrides: Record<string, unknown> = {}) {
  const response = await request('/admin/iako/profiles', admin, 'POST', {
    name: 'Vibe Coding Assistant', systemPrompt: 'You are a helpful coding mentor.',
    inScope: 'Questions about the training project.', outOfScope: 'Anything unrelated.',
    outOfScopeKeywords: [], visionEnabled: false, temperature: 0.2, active: true, ...overrides,
  });
  return data<{ id: string }>(response);
}
interface TopUpPolicy {
  initialRequestLimit: number; autoTopUpEnabled: boolean;
  autoTopUpAmount?: number; maxAutoTopUps?: number; maxAutoTotal?: number;
}
// Creates a brand-new LiveTraining, assigns a fresh profile to it with the
// given top-up policy, and returns both plus a real enrolled learner —
// mirrors the production shape (LIVE_TRAINING resourceType, a genuine
// LiveTrainingEnrollment) end-to-end, not a shortcut.
async function trainingWithTopUp(admin: User, topUp: TopUpPolicy, profileOverrides: Record<string, unknown> = {}) {
  const profile = await createProfile(admin, profileOverrides);
  const training = await prisma.liveTraining.create({ data: {
    title: `Top-up test ${randomUUID()}`, description: 'x', category: 'Engineering',
    scheduledAt: new Date('2026-09-01T12:00:00Z'), published: true, maxCapacity: 20,
  } });
  const assignResponse = await request(`/admin/iako/assignments/live-training/${training.id}`, admin, 'PUT', { profileId: profile.id, ...topUp });
  expect(assignResponse.status).toBe(200);
  const learner = await createUser();
  await prisma.liveTrainingEnrollment.create({ data: { liveTrainingId: training.id, userId: learner.id } });
  return { profile, training, learner };
}
async function grantFor(userId: string, liveTrainingId: string) {
  return prisma.iakoUsageGrant.findFirstOrThrow({ where: { userId, resourceType: 'LIVE_TRAINING', resourceId: liveTrainingId } });
}

describe('IAKO controlled auto-top-up', () => {
  it('a fresh grant starts at the assignment’s configured initial total, not the profile default', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 2, autoTopUpEnabled: true, autoTopUpAmount: 2, maxAutoTopUps: 1, maxAutoTotal: 4 });
    const response = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Hello');
    expect(response.status).toBe(200);
    const usage = (await data<{ usage: { requestLimit: number; requestsUsed: number } }>(response)).usage;
    expect(usage.requestLimit).toBe(2);
    expect(usage.requestsUsed).toBe(1);
  });

  it('reaching the initial total triggers exactly one automatic top-up, raising the ceiling to the configured maximum', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 2, autoTopUpEnabled: true, autoTopUpAmount: 2, maxAutoTopUps: 1, maxAutoTotal: 4 });
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'One')).status).toBe(200);
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two')).status).toBe(200);
    // The 3rd request lands exactly at 2/2 — auto-top-up must fire instead of a 429.
    const third = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Three');
    expect(third.status).toBe(200);
    const usage = (await data<{ usage: { requestLimit: number; requestsUsed: number } }>(third)).usage;
    expect(usage.requestLimit).toBe(4);
    expect(usage.requestsUsed).toBe(3);
    const grant = await grantFor(learner.id, training.id);
    expect(grant.autoTopUpsApplied).toBe(1);
  });

  it('a second automatic top-up never happens — the configured maximum is a hard automatic ceiling', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 2, autoTopUpEnabled: true, autoTopUpAmount: 2, maxAutoTopUps: 1, maxAutoTotal: 4 });
    for (const message of ['One', 'Two', 'Three', 'Four']) {
      expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, message)).status).toBe(200);
    }
    // Now at 4/4 (post-top-up ceiling) — a 5th request must be blocked, not
    // trigger a second top-up (200 -> 400 -> 600 is exactly what's forbidden).
    const fifth = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Five');
    expect(fifth.status).toBe(429);
    const grant = await grantFor(learner.id, training.id);
    expect(grant.requestLimit).toBe(4);
    expect(grant.autoTopUpsApplied).toBe(1);
  });

  it('disabled auto-top-up keeps the initial total a hard limit', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 2, autoTopUpEnabled: false });
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'One')).status).toBe(200);
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two')).status).toBe(200);
    const third = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Three');
    expect(third.status).toBe(429);
    const grant = await grantFor(learner.id, training.id);
    expect(grant.requestLimit).toBe(2);
    expect(grant.autoTopUpsApplied).toBe(0);
  });

  it('a provider failure at the top-up threshold never consumes a credit (accounting stays correct)', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 1, autoTopUpEnabled: true, autoTopUpAmount: 1, maxAutoTopUps: 1, maxAutoTotal: 2 });
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'One')).status).toBe(200);

    jest.mocked(callTextModel).mockImplementation(async (prompt: string) => {
      if (prompt.includes('strict scope classifier')) return JSON.stringify({ decision: 'IN_SCOPE' });
      throw new AiAgentError('The AI service is temporarily unavailable. Please retry.', 429);
    });
    const second = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two — provider will fail');
    expect(second.status).toBe(429);
    const grant = await grantFor(learner.id, training.id);
    // Exactly one real (counted) request was ever billed — the failed
    // attempt never created a counted log row, matching the pre-existing
    // "provider error must not consume credit" guarantee.
    expect(await prisma.iakoRequestLog.count({ where: { usageGrantId: grant.id, counted: true } })).toBe(1);
  });

  it('an out-of-scope refusal below the ceiling does not trigger a top-up', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 5, autoTopUpEnabled: true, autoTopUpAmount: 5, maxAutoTopUps: 1, maxAutoTotal: 10 });
    mockAiResponses('OUT_OF_SCOPE');
    const response = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'What is the weather today?');
    expect(response.status).toBe(200);
    expect((await data<{ outOfScope: boolean }>(response)).outOfScope).toBe(true);
    const grant = await grantFor(learner.id, training.id);
    expect(grant.requestLimit).toBe(5);
    expect(grant.autoTopUpsApplied).toBe(0);
  });

  it('a duplicate (same idempotencyKey) retry of the request that triggered a top-up replays the cached reply and never double-tops-up', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 1, autoTopUpEnabled: true, autoTopUpAmount: 1, maxAutoTopUps: 1, maxAutoTotal: 2 });
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'One')).status).toBe(200);

    const key = randomUUID();
    const first = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two', { idempotencyKey: key });
    expect(first.status).toBe(200);
    const firstUsage = (await data<{ usage: { requestLimit: number; requestsUsed: number } }>(first)).usage;
    expect(firstUsage).toEqual(expect.objectContaining({ requestLimit: 2, requestsUsed: 2 }));

    const replay = await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two', { idempotencyKey: key });
    expect(replay.status).toBe(200);
    const replayUsage = (await data<{ usage: { requestLimit: number; requestsUsed: number } }>(replay)).usage;
    expect(replayUsage).toEqual(expect.objectContaining({ requestLimit: 2, requestsUsed: 2 }));

    const grant = await grantFor(learner.id, training.id);
    expect(grant.autoTopUpsApplied).toBe(1);
  });

  it('two concurrent requests at the threshold apply at most one top-up', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 1, autoTopUpEnabled: true, autoTopUpAmount: 1, maxAutoTopUps: 1, maxAutoTotal: 2 });
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'One')).status).toBe(200);

    // Both land exactly at the 1/1 threshold — the per-grant processing
    // lease (acquireUsageLease) means only one can ever be "in flight" at a
    // time; the other must be rejected outright (409), never both succeed.
    const [a, b] = await Promise.all([
      chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two-A', { idempotencyKey: randomUUID() }),
      chatRequest(`/iako/live-training/${training.id}/chat`, learner, 'Two-B', { idempotencyKey: randomUUID() }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const grant = await grantFor(learner.id, training.id);
    expect(grant.autoTopUpsApplied).toBe(1);
    expect(grant.requestLimit).toBe(2);
  });

  it('one learner’s top-up never affects a different learner’s own grant', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training, learner: learnerA } = await trainingWithTopUp(admin, { initialRequestLimit: 1, autoTopUpEnabled: true, autoTopUpAmount: 1, maxAutoTopUps: 1, maxAutoTotal: 2 });
    const learnerB = await createUser();
    await prisma.liveTrainingEnrollment.create({ data: { liveTrainingId: training.id, userId: learnerB.id } });

    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learnerA, 'One')).status).toBe(200);
    expect((await chatRequest(`/iako/live-training/${training.id}/chat`, learnerA, 'Two')).status).toBe(200);
    const grantA = await grantFor(learnerA.id, training.id);
    expect(grantA.requestLimit).toBe(2);

    const bResponse = await chatRequest(`/iako/live-training/${training.id}/chat`, learnerB, 'Hi');
    expect(bResponse.status).toBe(200);
    const bUsage = (await data<{ usage: { requestLimit: number } }>(bResponse)).usage;
    expect(bUsage.requestLimit).toBe(1);
    const grantB = await grantFor(learnerB.id, training.id);
    expect(grantB.autoTopUpsApplied).toBe(0);
  });

  it('a top-up on Training A never affects Training B’s own policy or grant', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const { training: trainingA, learner } = await trainingWithTopUp(admin, { initialRequestLimit: 1, autoTopUpEnabled: true, autoTopUpAmount: 1, maxAutoTopUps: 1, maxAutoTotal: 2 }, { name: 'Training A assistant' });
    const profileB = await createProfile(admin, { name: 'Training B assistant' });
    const trainingB = await prisma.liveTraining.create({ data: {
      title: `Top-up isolation B ${randomUUID()}`, description: 'x', category: 'Engineering',
      scheduledAt: new Date('2026-09-01T12:00:00Z'), published: true, maxCapacity: 20,
    } });
    expect((await request(`/admin/iako/assignments/live-training/${trainingB.id}`, admin, 'PUT', {
      profileId: profileB.id, initialRequestLimit: 5, autoTopUpEnabled: false,
    })).status).toBe(200);
    await prisma.liveTrainingEnrollment.create({ data: { liveTrainingId: trainingB.id, userId: learner.id } });

    expect((await chatRequest(`/iako/live-training/${trainingA.id}/chat`, learner, 'One')).status).toBe(200);
    expect((await chatRequest(`/iako/live-training/${trainingA.id}/chat`, learner, 'Two')).status).toBe(200);
    const grantA = await grantFor(learner.id, trainingA.id);
    expect(grantA.requestLimit).toBe(2);
    expect(grantA.autoTopUpsApplied).toBe(1);

    const bResponse = await chatRequest(`/iako/live-training/${trainingB.id}/chat`, learner, 'Hi B');
    expect(bResponse.status).toBe(200);
    const bUsage = (await data<{ usage: { requestLimit: number } }>(bResponse)).usage;
    expect(bUsage.requestLimit).toBe(5);
    const grantB = await grantFor(learner.id, trainingB.id);
    expect(grantB.autoTopUpsApplied).toBe(0);
  });

  it('the admin assignment endpoint rejects an internally-inconsistent top-up policy', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const profile = await createProfile(admin);
    const training = await prisma.liveTraining.create({ data: {
      title: `Top-up validation ${randomUUID()}`, description: 'x', category: 'Engineering',
      scheduledAt: new Date('2026-09-01T12:00:00Z'), published: true, maxCapacity: 20,
    } });
    const response = await request(`/admin/iako/assignments/live-training/${training.id}`, admin, 'PUT', {
      profileId: profile.id, autoTopUpEnabled: true, // amount/maxAutoTopUps/maxAutoTotal all missing
    });
    expect(response.status).toBe(400);
  });

  it('the admin assignment endpoint rejects a maximum total below the starting total', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const profile = await createProfile(admin, { defaultRequestLimit: 200 });
    const training = await prisma.liveTraining.create({ data: {
      title: `Top-up validation ${randomUUID()}`, description: 'x', category: 'Engineering',
      scheduledAt: new Date('2026-09-01T12:00:00Z'), published: true, maxCapacity: 20,
    } });
    const response = await request(`/admin/iako/assignments/live-training/${training.id}`, admin, 'PUT', {
      profileId: profile.id, initialRequestLimit: 200, autoTopUpEnabled: true, autoTopUpAmount: 50, maxAutoTopUps: 1, maxAutoTotal: 100,
    });
    expect(response.status).toBe(400);
    expect(await prisma.iakoProfileAssignment.findUnique({ where: { liveTrainingId: training.id } })).toBeNull();
  });
});
