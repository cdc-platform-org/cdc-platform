import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import iakoRouter from '../iako';
import adminIakoRouter from '../adminIako';
import adminAccessGrantRouter from '../adminAccessGrants';
import adminLiveTrainingEnrollmentRouter from '../adminLiveTrainingEnrollments';
import liveTrainingInviteRouter from '../liveTrainingInvites';
import { errorHandler } from '../../middleware/errorHandler';
import { callTextModel, isAiAgentConfigured } from '../../services/aiAgentService';
import { uploadImage } from '../../services/imageStorage';

jest.mock('../../services/aiAgentService', () => ({ callTextModel: jest.fn(), isAiAgentConfigured: jest.fn() }));
jest.mock('../../services/auditLogService', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/imageStorage', () => ({ uploadImage: jest.fn().mockResolvedValue('https://cdn.example.test/iako-screenshots/shot.png') }));
jest.mock('../../services/emailService', () => ({ sendLiveTrainingEnrollmentEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/whatsappService', () => ({ sendRegistrationStatusWhatsApp: jest.fn().mockResolvedValue(undefined), formatWhatsAppDate: jest.fn().mockReturnValue('December 2026') }));

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
  app.use('/admin/access-grants', adminAccessGrantRouter);
  app.use('/admin/live-trainings', adminLiveTrainingEnrollmentRouter);
  app.use('/live-trainings/invites', liveTrainingInviteRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isAiAgentConfigured).mockReturnValue(true);
  jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ response: 'A helpful, in-scope reply.' }));
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});

function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.1.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}

async function createProfile(admin: User, overrides: Record<string, unknown> = {}) {
  const response = await request('/admin/iako/profiles', admin, 'POST', {
    name: 'Tool Assistant', systemPrompt: 'You are a helpful assistant for this tool.',
    inScope: 'Questions about using this tool.', outOfScope: 'Anything unrelated to the tool.',
    outOfScopeKeywords: [], visionEnabled: false, temperature: 0.2, active: true, ...overrides,
  });
  return data<{ id: string }>(response);
}

describe('IAKO admin profile management', () => {
  it('creates, lists, and updates a reusable assistant profile', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const profile = await createProfile(admin);
    expect(profile.id).toBeTruthy();

    const list = await data<Array<{ id: string }>>(await request('/admin/iako/profiles', admin));
    expect(list.some((p) => p.id === profile.id)).toBe(true);

    const updated = await request(`/admin/iako/profiles/${profile.id}`, admin, 'PUT', {
      name: 'Renamed Assistant', systemPrompt: 'Updated persona.', inScope: 'Still tool questions.', outOfScopeKeywords: [],
    });
    expect(updated.status).toBe(200);
    expect((await data<{ name: string }>(updated)).name).toBe('Renamed Assistant');
  });

  it('rejects a non-admin from managing profiles', async () => {
    const learner = await createUser();
    const response = await request('/admin/iako/profiles', learner, 'POST', {
      name: 'x', systemPrompt: 'x', inScope: 'x',
    });
    expect(response.status).toBe(403);
  });
});

describe('IAKO Digital Tool assignment and chat', () => {
  async function assignedProfile(admin: User, overrides: Record<string, unknown> = {}) {
    const profile = await createProfile(admin, overrides);
    await request('/admin/iako/assignments/digital-tool/educator-hub', admin, 'PUT', { profileId: profile.id });
    return profile;
  }

  it('lets an entitled user chat, and persists the conversation across calls', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin);
    const learner = await createUser();
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'educator-hub', userId: learner.id, createdById: admin.id } });

    const first = await request('/iako/digital-tool/educator-hub/chat', learner, 'POST', { message: 'How do I use this tool?' });
    expect(first.status).toBe(200);
    expect((await data<{ reply: string }>(first)).reply).toBe('A helpful, in-scope reply.');

    await request('/iako/digital-tool/educator-hub/chat', learner, 'POST', { message: 'Follow-up question.' });
    const conversation = await data<{ messages: Array<{ role: string; content: string }> }>(await request('/iako/digital-tool/educator-hub/conversation', learner));
    expect(conversation.messages).toHaveLength(4);
    expect(conversation.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT', 'USER', 'ASSISTANT']);
  });

  it('rejects an unentitled user with 403 and never calls the model', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin);
    const stranger = await createUser();
    const response = await request('/iako/digital-tool/educator-hub/chat', stranger, 'POST', { message: 'Let me in?' });
    expect(response.status).toBe(403);
    expect(callTextModel).not.toHaveBeenCalled();
  });

  it('respects an AccessGrant time window — not yet started and already expired both deny access', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin);
    const notYet = await createUser();
    const expired = await createUser();
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'educator-hub', userId: notYet.id, createdById: admin.id, startsAt: new Date(Date.now() + 60 * 60 * 1000) } });
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'educator-hub', userId: expired.id, createdById: admin.id, expiresAt: new Date(Date.now() - 60 * 1000) } });

    expect((await request('/iako/digital-tool/educator-hub/chat', notYet, 'POST', { message: 'Hi' })).status).toBe(403);
    expect((await request('/iako/digital-tool/educator-hub/chat', expired, 'POST', { message: 'Hi' })).status).toBe(403);
  });

  it('resolves a grant issued by email before the person registered', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin);
    const email = `pending-${Date.now()}@cdc.test`;
    await request('/admin/access-grants', admin, 'POST', { resourceType: 'DIGITAL_TOOL', resourceId: 'educator-hub', email });
    const learner = await createUser({ email });
    const response = await request('/iako/digital-tool/educator-hub/chat', learner, 'POST', { message: 'Hi' });
    expect(response.status).toBe(200);
  });

  it('short-circuits an out-of-scope keyword without calling the model', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin, { outOfScopeKeywords: ['bitcoin'] });
    const learner = await createUser();
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'educator-hub', userId: learner.id, createdById: admin.id } });

    const response = await request('/iako/digital-tool/educator-hub/chat', learner, 'POST', { message: 'What do you think about bitcoin investing?' });
    expect(response.status).toBe(200);
    expect(callTextModel).not.toHaveBeenCalled();
    const reply = (await data<{ reply: string; outOfScope: boolean }>(response));
    expect(reply.outOfScope).toBe(true);
  });

  it('rejects an image attachment when the profile has vision disabled, and forwards it when enabled', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    await assignedProfile(admin, { visionEnabled: false });
    const learner = await createUser();
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'educator-hub', userId: learner.id, createdById: admin.id } });

    const form = new FormData();
    form.append('message', 'What does this screenshot show?');
    form.append('image', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'shot.png');
    const token = jwt.sign({ userId: learner.id, role: learner.role, email: learner.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const denied = await fetch(`${baseUrl}/iako/digital-tool/educator-hub/chat`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': `198.18.1.${++requestNumber}` }, body: form });
    expect(denied.status).toBe(400);
    expect(uploadImage).not.toHaveBeenCalled();

    await request('/admin/iako/assignments/digital-tool/educator-hub', admin, 'PUT', { profileId: (await assignedProfile(admin, { visionEnabled: true, name: 'Vision assistant' })).id });
    const form2 = new FormData();
    form2.append('message', 'What does this screenshot show?');
    form2.append('image', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'shot.png');
    const allowed = await fetch(`${baseUrl}/iako/digital-tool/educator-hub/chat`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': `198.18.1.${++requestNumber}` }, body: form2 });
    expect(allowed.status).toBe(200);
    expect(uploadImage).toHaveBeenCalled();
    const [, , imageParts] = jest.mocked(callTextModel).mock.calls.at(-1)!;
    expect(imageParts).toEqual([{ mimeType: 'image/png', data: expect.any(String) }]);
  });
});

describe('IAKO assigned to a Live Training', () => {
  it('reuses the training\'s real enrollment as entitlement, injects the syllabus as context, and blocks a non-enrollee', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const profile = await createProfile(admin);
    const training = await prisma.liveTraining.create({ data: {
      title: 'IAKO-assigned training', description: 'For IAKO live-training coverage.', category: 'Engineering',
      scheduledAt: new Date('2026-09-01T12:00:00Z'), published: true, maxCapacity: 20,
    } });
    await request(`/admin/iako/assignments/live-training/${training.id}`, admin, 'PUT', { profileId: profile.id });
    await prisma.trainingDay.create({ data: {
      liveTrainingId: training.id, dayNumber: 1, title: 'Orientation', summary: 'Kickoff day summary.', published: true, sections: [],
    } });

    const outsider = await createUser();
    expect((await request(`/iako/live-training/${training.id}/chat`, outsider, 'POST', { message: 'Hi' })).status).toBe(403);
    expect(callTextModel).not.toHaveBeenCalled();

    const learner = await createUser();
    await prisma.liveTrainingEnrollment.create({ data: { liveTrainingId: training.id, userId: learner.id } });
    const response = await request(`/iako/live-training/${training.id}/chat`, learner, 'POST', { message: 'What are we covering?' });
    expect(response.status).toBe(200);
    const [prompt] = jest.mocked(callTextModel).mock.calls[0];
    expect(prompt).toContain('Orientation');
  });
});

describe('IAKO knowledge base retrieval', () => {
  it('includes an uploaded document\'s content in the model prompt when it matches the question', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const profile = await createProfile(admin);
    await request('/admin/iako/assignments/digital-tool/media-studio', admin, 'PUT', { profileId: profile.id });
    await prisma.iakoKnowledgeDocument.create({ data: { profileId: profile.id, sourceFilename: 'guide.md', chunkIndex: 0, totalChunks: 1, content: 'The export button is in the top-right toolbar of the editor.' } });
    const learner = await createUser();
    await prisma.accessGrant.create({ data: { resourceType: 'DIGITAL_TOOL', resourceId: 'media-studio', userId: learner.id, createdById: admin.id } });

    await request('/iako/digital-tool/media-studio/chat', learner, 'POST', { message: 'Where is the export button?' });
    const [prompt] = jest.mocked(callTextModel).mock.calls[0];
    expect(prompt).toContain('export button is in the top-right toolbar');
  });
});

describe('Live Training manual enrollment and QR invites', () => {
  async function createTraining(price: number | null) {
    return prisma.liveTraining.create({ data: {
      title: 'Invite test training', description: 'Invite flow coverage.', category: 'Engineering',
      scheduledAt: new Date('2030-01-15T14:00:00Z'), published: true, maxCapacity: 20, price,
    } });
  }

  it('lets an admin manually enroll a user by email, bypassing payment', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const training = await createTraining(10000);
    const learner = await createUser();

    const response = await request(`/admin/live-trainings/${training.id}/enrollments`, admin, 'POST', { email: learner.email });
    expect(response.status).toBe(201);
    const enrollment = await prisma.liveTrainingEnrollment.findUnique({ where: { userId_liveTrainingId: { userId: learner.id, liveTrainingId: training.id } } });
    expect(enrollment?.status).toBe('ACTIVE');
  });

  it('redeems a free-training invite and creates an active enrollment', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const training = await createTraining(null);
    const learner = await createUser();

    const invite = await data<{ token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 5 }));
    const response = await request(`/live-trainings/invites/${invite.token}/redeem`, learner, 'POST', {});
    expect(response.status).toBe(200);
    const enrollment = await prisma.liveTrainingEnrollment.findUnique({ where: { userId_liveTrainingId: { userId: learner.id, liveTrainingId: training.id } } });
    expect(enrollment?.status).toBe('ACTIVE');
  });

  it('NEVER lets a QR invite bypass payment for a paid training', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const training = await createTraining(15000);
    const learner = await createUser();

    const invite = await data<{ token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 5 }));
    const response = await request(`/live-trainings/invites/${invite.token}/redeem`, learner, 'POST', {});
    expect(response.status).toBe(400);
    const enrollment = await prisma.liveTrainingEnrollment.findUnique({ where: { userId_liveTrainingId: { userId: learner.id, liveTrainingId: training.id } } });
    expect(enrollment).toBeNull();
  });

  it('rejects a redemption after revocation, after expiry, past its redemption cap, or by the wrong email', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const training = await createTraining(null);

    const revoked = await data<{ id: string; token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 5 }));
    await request(`/admin/live-trainings/${training.id}/invites/${revoked.id}/revoke`, admin, 'POST', {});
    expect((await request(`/live-trainings/invites/${revoked.token}/redeem`, await createUser(), 'POST', {})).status).toBe(410);

    const expired = await data<{ token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 5, expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect((await request(`/live-trainings/invites/${expired.token}/redeem`, await createUser(), 'POST', {})).status).toBe(410);

    const single = await data<{ token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 1 }));
    expect((await request(`/live-trainings/invites/${single.token}/redeem`, await createUser(), 'POST', {})).status).toBe(200);
    expect((await request(`/live-trainings/invites/${single.token}/redeem`, await createUser(), 'POST', {})).status).toBe(410);

    const restricted = await data<{ token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 5, email: 'only-me@cdc.test' }));
    expect((await request(`/live-trainings/invites/${restricted.token}/redeem`, await createUser(), 'POST', {})).status).toBe(403);
  });

  it('does not double-count a redemption when the same user redeems their own invite twice', async () => {
    const admin = await createUser({ adminRole: 'MANAGER' });
    const training = await createTraining(null);
    const learner = await createUser();
    const invite = await data<{ id: string; token: string }>(await request(`/admin/live-trainings/${training.id}/invites`, admin, 'POST', { maxRedemptions: 5 }));

    await request(`/live-trainings/invites/${invite.token}/redeem`, learner, 'POST', {});
    await request(`/live-trainings/invites/${invite.token}/redeem`, learner, 'POST', {});
    const stored = await prisma.liveTrainingInvite.findUnique({ where: { id: invite.id } });
    expect(stored?.redemptionCount).toBe(1);
  });
});
