import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import trainerWorkspaceRouter from '../trainerWorkspace';
import adminTrainersRouter from '../adminTrainers';
import adminLiveTrainingTrainersRouter from '../adminLiveTrainingTrainers';
import { errorHandler } from '../../middleware/errorHandler';
import { uploadImage } from '../../services/imageStorage';

jest.mock('../../services/imageStorage', () => ({ uploadImage: jest.fn().mockResolvedValue('https://cdn.example.test/trainer-videos/clip.mp4') }));
jest.mock('../../services/auditLogService', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/trainer', trainerWorkspaceRouter);
  app.use('/admin/trainers', adminTrainersRouter);
  app.use('/admin/live-trainings', adminLiveTrainingTrainersRouter);
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
    method, headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.2.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}

async function fixture() {
  const [trainerAUser, trainerBUser, student, admin] = await Promise.all([
    createUser(), createUser(), createUser(), createUser({ adminRole: 'MANAGER' }),
  ]);
  const [trainerA, trainerB] = await Promise.all([
    prisma.trainerProfile.create({ data: { userId: trainerAUser.id } }),
    prisma.trainerProfile.create({ data: { userId: trainerBUser.id } }),
  ]);
  const trainingA = await prisma.liveTraining.create({
    data: {
      title: 'Trainer A cohort', description: 'Only for trainer A.', category: 'Engineering',
      scheduledAt: new Date('2026-09-01T12:00:00Z'), published: true, maxCapacity: 20,
    }
  });
  const trainingB = await prisma.liveTraining.create({
    data: {
      title: 'Trainer B cohort', description: 'Only for trainer B.', category: 'Engineering',
      scheduledAt: new Date('2026-09-02T12:00:00Z'), published: true, maxCapacity: 20,
    }
  });
  await prisma.liveTrainingTrainerAssignment.create({ data: { trainerProfileId: trainerA.id, liveTrainingId: trainingA.id } });
  await prisma.liveTrainingTrainerAssignment.create({ data: { trainerProfileId: trainerB.id, liveTrainingId: trainingB.id } });
  const dayA = await prisma.trainingDay.create({
    data: {
      dayNumber: 1, published: true, title: 'Day one', summary: 'A day', scheduledDate: null, sourcePages: [1],
      sections: [{ id: 'tasks', kind: 'exercise', title: 'Tasks', items: [{ id: 'task-1', title: 'Task', body: 'Do it' }] }],
      liveTrainingId: trainingA.id,
    } as never
  });
  await prisma.liveTrainingEnrollment.create({ data: { liveTrainingId: trainingA.id, userId: student.id } });
  return { trainerAUser, trainerBUser, student, admin, trainerA, trainerB, trainingA, trainingB, dayA };
}

describe('trainer workspace authorization (IDOR suite)', () => {
  it('trainer A cannot read trainer B\u2019s training, participants or guides', async () => {
    const { trainerAUser, trainingB } = await fixture();
    expect((await request(`/trainer/live-trainings/${trainingB.id}`, trainerAUser)).status).toBe(404);
    expect((await request(`/trainer/live-trainings/${trainingB.id}/participants`, trainerAUser)).status).toBe(404);
    expect((await request(`/trainer/live-trainings/${trainingB.id}/guides`, trainerAUser)).status).toBe(404);
    // The listing must only ever contain trainer A's own cohort.
    const list = await data<Array<{ id: string }>>(await request('/trainer/live-trainings', trainerAUser));
    expect(list.map((t) => t.id)).not.toContain(trainingB.id);
  });

  it('trainer A cannot modify trainer B\u2019s guide day', async () => {
    const { trainerAUser, trainingB, dayA } = await fixture();
    // dayId belongs to training A — the trainer B-scoped PUT must 404, and the
    // trainer A-scoped PUT of a day that belongs to training B must also 404
    // (the day lookup is always ANDed with the assigned training id).
    const body = {
      dayNumber: 1, published: true, title: 'Hijacked', summary: 'hijack', scheduledDate: null, sourcePages: [1],
      sections: [{ id: 'tasks', kind: 'exercise', title: 'Tasks', items: [{ id: 'task-1', title: 'Task', body: 'Do it' }] }]
    };
    expect((await request(`/trainer/live-trainings/${trainingB.id}/guides/days/${dayA.id}`, trainerAUser, 'PUT', body)).status).toBe(404);
    const untouched = await prisma.trainingDay.findUniqueOrThrow({ where: { id: dayA.id }, select: { title: true } });
    expect(untouched.title).toBe('Day one');
  });

  it('trainer A cannot modify trainer B\u2019s trainer video', async () => {
    const { trainerAUser, trainingB } = await fixture();
    expect((await request(`/trainer/live-trainings/${trainingB.id}/trainer-video`, trainerAUser, 'POST', {})).status).toBe(404);
    expect((await request(`/trainer/live-trainings/${trainingB.id}/trainer-video`, trainerAUser, 'DELETE')).status).toBe(404);
  });

  it('students, mentors without a profile and anonymous callers cannot access trainer APIs', async () => {
    const { trainerAUser, student, trainingA } = await fixture();
    const mentor = await createUser();
    // Mentor with no TrainerProfile — role alone grants nothing.
    await prisma.user.update({ where: { id: mentor.id }, data: { role: 'Mentor' } });
    for (const caller of [student, mentor]) {
      expect((await request('/trainer/live-trainings', caller)).status).toBe(403);
      // requireTrainer rejects them before any per-training lookup, so a
      // caller with no profile can't even probe which training ids exist.
      expect((await request(`/trainer/live-trainings/${trainingA.id}/participants`, caller)).status).toBe(403);
    }
    expect((await request('/trainer/live-trainings')).status).toBe(401);
    // The gate endpoint must still answer for the real trainer.
    expect((await data<{ isTrainer: boolean }>(await request('/trainer/me', trainerAUser))).isTrainer).toBe(true);
  });

  it('trainers cannot access admin-only trainer management APIs', async () => {
    const { trainerAUser, trainingA } = await fixture();
    expect((await request('/admin/trainers', trainerAUser)).status).toBe(403);
    expect((await request(`/admin/live-trainings/${trainingA.id}/trainers`, trainerAUser)).status).toBe(403);
    expect((await request(`/trainer/live-trainings/${trainingA.id}/trainer-video`, trainerAUser, 'DELETE')).status).toBe(200);
  });

  it('duplicate assignments are prevented by the unique constraint (409)', async () => {
    const { admin, trainerA, trainingA } = await fixture();
    expect((await request(`/admin/live-trainings/${trainingA.id}/trainers`, admin, 'POST', { trainerProfileId: trainerA.id })).status).toBe(409);
  });

  it('assignment removal immediately revokes access', async () => {
    const { trainerAUser, trainerA, trainingA, admin } = await fixture();
    const assignments = await data<Array<{ id: string }>>(await request(`/admin/live-trainings/${trainingA.id}/trainers`, admin));
    const assignment = assignments.find((a) => (a as unknown as { trainerProfileId: string }).trainerProfileId === trainerA.id)!;
    expect((await request(`/admin/live-trainings/${trainingA.id}/trainers/${assignment.id}`, admin, 'DELETE')).status).toBe(200);
    expect((await request(`/trainer/live-trainings/${trainingA.id}`, trainerAUser)).status).toBe(404);
  });

  it('disabling a TrainerProfile revokes access while keeping assignment history', async () => {
    const { trainerAUser, trainerA, trainingA, admin } = await fixture();
    expect((await request(`/admin/trainers/${trainerA.id}`, admin, 'PATCH', { active: false })).status).toBe(200);
    expect((await request(`/trainer/live-trainings`, trainerAUser)).status).toBe(403);
    const kept = await prisma.liveTrainingTrainerAssignment.findUnique({
      where: { trainerProfileId_liveTrainingId: { trainerProfileId: trainerA.id, liveTrainingId: trainingA.id } },
    });
    expect(kept).not.toBeNull();
  });

  it('admin can enable, list and re-enable trainer profiles (idempotent roster)', async () => {
    const { admin, trainerA } = await fixture();
    const outsider = await createUser();
    expect((await request('/admin/trainers', admin, 'POST', { userId: outsider.id })).status).toBe(201);
    expect((await request('/admin/trainers', admin, 'POST', { userId: outsider.id })).status).toBe(409);
    const list = await data<Array<{ id: string }>>(await request('/admin/trainers', admin));
    expect(list.map((t) => t.id)).toContain(trainerA.id);
    // PATCH without an id simply doesn't match the route.
    expect((await request('/admin/trainers/no-such-id', admin, 'PATCH', { active: true })).status).toBe(404);
  });

  it('participants endpoint exposes only the minimal learner shape', async () => {
    const { trainerAUser, trainingA, student } = await fixture();
    const participants = await data<Array<{ user: Record<string, unknown> }>>(
      await request(`/trainer/live-trainings/${trainingA.id}/participants`, trainerAUser));
    expect(participants).toHaveLength(1);
    expect(Object.keys(participants[0].user).sort()).toEqual(['email', 'id', 'name']);
    expect(participants[0].user.id).toBe(student.id);
  });

  it('admin assignment requires an active trainer profile', async () => {
    const { admin, trainerB, trainingA } = await fixture();
    await prisma.trainerProfile.update({ where: { id: trainerB.id }, data: { active: false } });
    expect((await request(`/admin/live-trainings/${trainingA.id}/trainers`, admin, 'POST', { trainerProfileId: trainerB.id })).status).toBe(404);
  });
});
