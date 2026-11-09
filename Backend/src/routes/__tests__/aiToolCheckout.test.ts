import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import paymentsRouter from '../payments';
import agentsRouter from '../agents';
import educatorHubRouter from '../educatorHub';
import { errorHandler } from '../../middleware/errorHandler';
import { createBogOrder } from '../../services/bogPaymentService';
import { pauseExpiredTrialAgents } from '../../services/agentBillingService';
import { completeAgentPurchase } from '../../services/agentSubscriptionService';
import { completeEducatorVipPurchase } from '../../services/educatorVipService';

// ============================================================
// Self-service BOG checkout for Educator VIP (50 GEL / 30 days) and a
// Business AI agent (49 GEL / 30 days), each with a promo code field, plus
// the Business AI rule that an owner can't switch an agent back on without
// a paid period. createBogOrder is mocked: no real BOG order is ever placed.
// ============================================================

jest.mock('../../services/bogPaymentService', () => ({
  ...jest.requireActual('../../services/bogPaymentService'),
  createBogOrder: jest.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/payments', paymentsRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/educator-hub', educatorHubRouter);
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

async function request(path: string, user: User, method = 'GET', body?: unknown) {
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.9.${++requestNumber % 250}`, Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function promo(target: string, discountPercent: number) {
  return prisma.promoCode.create({
    data: { code: `AI${randomUUID().slice(0, 8).toUpperCase()}`, discountPercent, applicableType: 'AI_TOOL', applicableTargetIds: [target] },
  });
}

async function createAgent(user: User, overrides: Partial<Prisma.AgentUncheckedCreateInput> = {}) {
  return prisma.agent.create({
    data: {
      businessId: user.id,
      name: 'Test agent',
      systemPrompt: 'You answer questions about the shop.',
      allowedOrigins: ['https://shop.example.test'],
      trialEndsAt: new Date(Date.now() + 14 * DAY),
      ...overrides,
    },
  });
}

describe('Educator VIP checkout', () => {
  it('opens a 50 GEL BOG order, and a promo code lowers it', async () => {
    const teacher = await createUser();
    const full = await request('/api/payments/checkout/educator-vip', teacher, 'POST', {});
    expect(full.status).toBe(201);
    expect(jest.mocked(createBogOrder).mock.calls[0][0].amount).toBe(5000);

    const code = await promo('educator-hub', 20);
    const discounted = await request('/api/payments/checkout/educator-vip', teacher, 'POST', { promoCode: code.code });
    expect(discounted.status).toBe(201);
    expect(jest.mocked(createBogOrder).mock.calls[1][0].amount).toBe(4000);
    const row = await prisma.bogPayment.findFirstOrThrow({ where: { userId: teacher.id, purpose: 'EDUCATOR_VIP', promoCodeId: code.id } });
    expect(row.status).toBe('PENDING');
  });

  it('a 100% code grants 30 days of VIP without BOG, and /state shows it', async () => {
    const teacher = await createUser();
    const code = await promo('educator-hub', 100);
    const res = await request('/api/payments/checkout/educator-vip', teacher, 'POST', { promoCode: code.code });
    expect(res.status).toBe(201);
    expect(createBogOrder).not.toHaveBeenCalled();

    const state = (await (await request('/api/educator-hub/state', teacher)).json()) as { data: { hasAccess: boolean; isVipActive: boolean; educatorVipPaidUntil: string } };
    expect(state.data.hasAccess).toBe(true);
    expect(state.data.isVipActive).toBe(true);
    const until = new Date(state.data.educatorVipPaidUntil).getTime();
    expect(until).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it('a code for another tool is refused', async () => {
    const teacher = await createUser();
    const code = await promo('english-tutor', 50);
    const res = await request('/api/payments/checkout/educator-vip', teacher, 'POST', { promoCode: code.code });
    expect(res.status).toBe(400);
  });

  it('an early renewal extends the paid period instead of resetting it', async () => {
    const teacher = await createUser({ educatorVipPaidUntil: new Date(Date.now() + 10 * DAY) });
    const { educatorVipPaidUntil } = await completeEducatorVipPurchase(teacher.id);
    expect(educatorVipPaidUntil.getTime()).toBeGreaterThan(Date.now() + 39 * DAY);
  });
});

describe('Business AI agent checkout', () => {
  it('opens a 49 GEL BOG order for the owner\'s agent, with promo support', async () => {
    const owner = await createUser();
    const agent = await createAgent(owner, { status: 'PAUSED', trialEndsAt: new Date(Date.now() - DAY) });
    const full = await request(`/api/payments/checkout/business-ai/${agent.id}`, owner, 'POST', {});
    expect(full.status).toBe(201);
    expect(jest.mocked(createBogOrder).mock.calls[0][0].amount).toBe(4900);

    const code = await promo('business-ai', 100);
    const free = await request(`/api/payments/checkout/business-ai/${agent.id}`, owner, 'POST', { promoCode: code.code });
    expect(free.status).toBe(201);
    const after = await prisma.agent.findUniqueOrThrow({ where: { id: agent.id } });
    expect(after.status).toBe('ACTIVE');
    expect(after.paidUntil!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it('refuses someone else\'s agent, and a second running agent', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const paused = await createAgent(owner, { status: 'PAUSED' });
    expect((await request(`/api/payments/checkout/business-ai/${paused.id}`, stranger, 'POST', {})).status).toBe(404);

    await createAgent(owner, { status: 'TRIAL' });
    const res = await request(`/api/payments/checkout/business-ai/${paused.id}`, owner, 'POST', {});
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe('AGENT_LIMIT_REACHED');
  });

  it('an owner can no longer switch a paused agent on without paying', async () => {
    const owner = await createUser();
    const agent = await createAgent(owner, { status: 'PAUSED', trialEndsAt: new Date(Date.now() - DAY) });
    const res = await request(`/api/agents/${agent.id}`, owner, 'PUT', { status: 'ACTIVE' });
    expect(res.status).toBe(402);
    expect((await prisma.agent.findUniqueOrThrow({ where: { id: agent.id } })).status).toBe('PAUSED');

    // Inside a paid period, resuming works again.
    await prisma.agent.update({ where: { id: agent.id }, data: { paidUntil: new Date(Date.now() + 5 * DAY) } });
    const ok = await request(`/api/agents/${agent.id}`, owner, 'PUT', { status: 'ACTIVE' });
    expect(ok.status).toBe(200);
  });

  it('the hourly sweep pauses an agent whose paid period ran out, but not an admin-activated one', async () => {
    const owner = await createUser();
    const lapsed = await createAgent(owner, { status: 'ACTIVE', paidUntil: new Date(Date.now() - 60_000) });
    const adminSet = await createAgent(owner, { status: 'ACTIVE', paidUntil: null });
    const { pausedAgentIds } = await pauseExpiredTrialAgents();
    expect(pausedAgentIds).toContain(lapsed.id);
    expect(pausedAgentIds).not.toContain(adminSet.id);
    expect((await prisma.agent.findUniqueOrThrow({ where: { id: adminSet.id } })).status).toBe('ACTIVE');
  });

  it('paying during the trial keeps the remaining trial days', async () => {
    const owner = await createUser();
    const agent = await createAgent(owner, { status: 'TRIAL', trialEndsAt: new Date(Date.now() + 10 * DAY) });
    const done = await completeAgentPurchase(agent.id);
    expect(done!.paidUntil.getTime()).toBeGreaterThan(Date.now() + 39 * DAY);
  });

  it('completing a payment for a deleted agent is a no-op', async () => {
    expect(await completeAgentPurchase(randomUUID())).toBeNull();
  });
});
