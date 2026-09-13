import 'express-async-errors';
import express, { ErrorRequestHandler } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import { liveTrainingRegisterSchema } from '../../schemas/liveTrainingSchemas';
import liveTrainingsRouter from '../liveTrainings';
import adminLiveTrainingsRouter from '../adminLiveTrainings';
import { sendLiveTrainingRegistrationEmail } from '../../services/emailService';

jest.mock('../../services/emailService', () => ({
  sendLiveTrainingRegistrationEmail: jest.fn().mockResolvedValue(undefined),
  sendLiveTrainingEnrollmentEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/whatsappService', () => ({
  sendRegistrationStatusWhatsApp: jest.fn().mockResolvedValue(undefined),
  formatWhatsAppDate: jest.fn().mockReturnValue('September 2026'),
}));

let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/live-trainings', liveTrainingsRouter);
  app.use('/admin/live-trainings', adminLiveTrainingsRouter);
  app.use(((error, _req, res, _next) => {
    res.status(500).json({ message: error.message });
  }) as ErrorRequestHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  await prisma.$disconnect();
});

beforeEach(() => jest.clearAllMocks());

async function createTraining(maxCapacity = 20) {
  return prisma.liveTraining.create({
    data: {
      title: 'Lead registration test',
      description: 'A live training used for callback registration tests.',
      category: 'Engineering',
      scheduledAt: new Date('2026-12-01T12:00:00Z'),
      published: true,
      maxCapacity,
      price: 70000,
    },
  });
}

function register(trainingId: string, body: unknown) {
  return fetch(`${baseUrl}/live-trainings/${trainingId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${++requestNumber}` },
    body: JSON.stringify(body),
  });
}

const callbackDetails = { firstName: 'ნინო', lastName: 'მაისურაძე', phone: '599 12 34 56' };

describe('live training callback registration validation', () => {
  it.each(['firstName', 'lastName', 'phone'] as const)('rejects a missing %s', (field) => {
    const body: Record<string, string> = { ...callbackDetails };
    delete body[field];
    expect(liveTrainingRegisterSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    { firstName: '   ' },
    { lastName: '<script>' },
    { phone: 'hello world' },
    { phone: '5555' },
    { phone: '+995 599 123' },
    { phone: '111111111' },
    { website: 'https://spam.example' },
  ])('rejects invalid or obvious spam fields: %j', (invalid) => {
    expect(liveTrainingRegisterSchema.safeParse({ ...callbackDetails, ...invalid }).success).toBe(false);
  });

  it.each(['+995 599 12 34 56', '00995 599 12 34 56', '599123456', '+1 (212) 555-0123', '+44 20 7946 0958'])
  ('accepts reasonable Georgian and international numbers: %s', (phone) => {
    expect(liveTrainingRegisterSchema.safeParse({ ...callbackDetails, phone }).success).toBe(true);
  });
});

describe('live training callback registration API and admin compatibility', () => {
  it('stores first name + last name in the existing name column, with phone and no email or enrollment', async () => {
    const training = await createTraining();
    const response = await register(training.id, callbackDetails);
    expect(response.status).toBe(201);
    const { data } = await response.json() as { data: { id: string } };
    const saved = await prisma.liveTrainingLead.findUniqueOrThrow({ where: { id: data.id } });
    expect(saved).toMatchObject({ name: 'ნინო მაისურაძე', phone: '+995599123456', email: null, status: 'NOT_CONTACTED' });
    expect(await prisma.liveTrainingEnrollment.count({ where: { liveTrainingId: training.id } })).toBe(0);
    expect(sendLiveTrainingRegistrationEmail).not.toHaveBeenCalled();

    const admin = await createUser({ adminRole: 'MANAGER' });
    const token = jwt.sign({ userId: admin.id, role: admin.role, email: admin.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const headers = { Authorization: `Bearer ${token}` };
    const listing = await fetch(`${baseUrl}/admin/live-trainings/${training.id}/leads`, { headers });
    expect(listing.status).toBe(200);
    expect((await listing.json() as { data: unknown[] }).data).toEqual([expect.objectContaining({ id: saved.id, email: null })]);
    const csv = await fetch(`${baseUrl}/admin/live-trainings/${training.id}/leads/export`, { headers });
    expect(csv.status).toBe(200);
    expect(await csv.text()).toContain('"ნინო მაისურაძე","","+995599123456"');

    const update = await fetch(`${baseUrl}/admin/live-trainings/leads/${saved.id}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONTACTED', adminNote: 'Called the prospective trainee.' }),
    });
    expect(update.status).toBe(200);
    expect((await update.json() as { data: unknown }).data).toMatchObject({ status: 'CONTACTED', adminNote: 'Called the prospective trainee.' });
  });

  it('preserves legacy submissions and historical email in admin listing/export', async () => {
    const training = await createTraining();
    const response = await register(training.id, { name: 'Legacy Visitor', email: 'legacy@example.test', phone: '+44 20 7946 0958' });
    expect(response.status).toBe(201);
    expect(sendLiveTrainingRegistrationEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'legacy@example.test', userName: 'Legacy Visitor' }));

    const historical = await prisma.liveTrainingLead.create({
      data: { liveTrainingId: training.id, name: 'Historical Visitor', email: 'historical@example.test', phone: '+995 577 12 34 56' },
    });
    const admin = await createUser({ adminRole: 'MANAGER' });
    const token = jwt.sign({ userId: admin.id, role: admin.role, email: admin.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const headers = { Authorization: `Bearer ${token}` };
    const listing = await fetch(`${baseUrl}/admin/live-trainings/${training.id}/leads`, { headers });
    expect((await listing.json() as { data: unknown[] }).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: historical.id, name: 'Historical Visitor', email: 'historical@example.test', phone: '+995 577 12 34 56' }),
    ]));
    const csv = await fetch(`${baseUrl}/admin/live-trainings/${training.id}/leads/export`, { headers });
    expect(await csv.text()).toContain('"Historical Visitor","historical@example.test","+995 577 12 34 56"');
  });

  it('rejects missing fields at the API without creating a lead', async () => {
    const training = await createTraining();
    const response = await register(training.id, { firstName: 'Nino', phone: '+995599123456' });
    expect(response.status).toBe(400);
    expect(await prisma.liveTrainingLead.count({ where: { liveTrainingId: training.id } })).toBe(0);
  });

  it('deduplicates simultaneous retries after phone normalization', async () => {
    const training = await createTraining(1);
    const responses = await Promise.all([
      register(training.id, callbackDetails),
      register(training.id, { ...callbackDetails, phone: '+995599123456' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const bodies = await Promise.all(responses.map((response) => response.json())) as Array<{ data: { id: string } }>;
    expect(bodies[0].data.id).toBe(bodies[1].data.id);
    expect(await prisma.liveTrainingLead.count({ where: { liveTrainingId: training.id } })).toBe(1);
  });

  it('only accepts one of two distinct simultaneous submissions for the last seat', async () => {
    const training = await createTraining(1);
    const responses = await Promise.all([
      register(training.id, callbackDetails),
      register(training.id, { ...callbackDetails, phone: '+995577123456' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.liveTrainingLead.count({ where: { liveTrainingId: training.id } })).toBe(1);
  });

  it('does not expose admin lead contact details to anonymous visitors', async () => {
    const training = await createTraining();
    const response = await fetch(`${baseUrl}/admin/live-trainings/${training.id}/leads`);
    expect(response.status).toBe(401);
  });
});
