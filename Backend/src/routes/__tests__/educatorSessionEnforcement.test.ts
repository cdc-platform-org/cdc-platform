import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import educatorHubRoutes from '../educatorHub';
import { errorHandler } from '../../middleware/errorHandler';
import { issueSessionId } from '../../services/educatorVipService';

// D7 — requireCurrentEducatorSession (middleware/auth.ts) used to be a
// no-op ("Concurrent login restriction disabled"). This suite covers the
// restored enforcement: a token's `sid` claim must match the user's
// current User.currentSessionId (rotated by issueSessionId on every
// login), scoped to just the Educator Hub generation/quiz routes — not a
// global single-session lock on authenticate() itself.

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/educator-hub', educatorHubRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

function signToken(user: User, sid?: string) {
  return jwt.sign({ userId: user.id, role: user.role, email: user.email, sid }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
}

function request(path: string, token?: string, method = 'GET') {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `198.18.9.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function createTeacherWithQuiz() {
  const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
  const quiz = await prisma.teacherQuiz.create({
    data: {
      teacherId: teacher.id,
      title: 'Session Enforcement Quiz',
      language: 'en',
      questions: { create: [{ order: 0, type: 'MULTIPLE_CHOICE', question: 'Q?', options: { A: '1', B: '2' }, correctAnswer: 'A' }] },
    },
  });
  return { teacher, quiz };
}

describe('D7 — single active Educator Hub session', () => {
  it('1. a token whose sid matches the current session is allowed', async () => {
    const { teacher, quiz } = await createTeacherWithQuiz();
    const sid = await issueSessionId(teacher.id);
    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, signToken(teacher, sid));
    expect(res.status).toBe(200);
  });

  it('2. a superseded sid (an older login) is rejected with a distinct 409', async () => {
    const { teacher, quiz } = await createTeacherWithQuiz();
    const oldSid = await issueSessionId(teacher.id);
    const oldToken = signToken(teacher, oldSid);
    await issueSessionId(teacher.id); // a second login elsewhere supersedes the first

    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, oldToken);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('EDUCATOR_SESSION_SUPERSEDED');
  });

  it('3. a second login rotates currentSessionId away from the first', async () => {
    const { teacher } = await createTeacherWithQuiz();
    const firstSid = await issueSessionId(teacher.id);
    const secondSid = await issueSessionId(teacher.id);
    expect(secondSid).not.toBe(firstSid);
    const stored = await prisma.user.findUnique({ where: { id: teacher.id }, select: { currentSessionId: true } });
    expect(stored?.currentSessionId).toBe(secondSid);
    expect(stored?.currentSessionId).not.toBe(firstSid);
  });

  it('4. the first session\'s token becomes invalid for Educator Hub once a second login has occurred', async () => {
    const { teacher, quiz } = await createTeacherWithQuiz();
    const firstSid = await issueSessionId(teacher.id);
    const firstToken = signToken(teacher, firstSid);
    await issueSessionId(teacher.id);

    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, firstToken);
    expect(res.status).toBe(409);
  });

  it('5. the newest session remains valid after an older one is superseded', async () => {
    const { teacher, quiz } = await createTeacherWithQuiz();
    await issueSessionId(teacher.id);
    const secondSid = await issueSessionId(teacher.id);
    const secondToken = signToken(teacher, secondSid);

    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, secondToken);
    expect(res.status).toBe(200);
  });

  it('6. a superseded token still authenticates fine on a non-gated Educator Hub route (not a global single-session lock)', async () => {
    const { teacher } = await createTeacherWithQuiz();
    const oldSid = await issueSessionId(teacher.id);
    const oldToken = signToken(teacher, oldSid);
    await issueSessionId(teacher.id); // supersede it

    // GET /state is guarded only by authenticate()+requireApproved at the
    // router level — deliberately not requireCurrentEducatorSession (see
    // educatorHub.ts's own comment on that route) — proving the lock is
    // scoped to the generation/quiz routes, not wired into authenticate().
    const res = await request('/api/educator-hub/state', oldToken);
    expect(res.status).toBe(200);
  });

  it('7. the 409 response never exposes sid or session identifier values', async () => {
    const { teacher, quiz } = await createTeacherWithQuiz();
    const oldSid = await issueSessionId(teacher.id);
    const oldToken = signToken(teacher, oldSid);
    const newSid = await issueSessionId(teacher.id);

    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, oldToken);
    expect(res.status).toBe(409);
    const raw = await res.text();
    expect(raw).not.toContain(oldSid);
    expect(raw).not.toContain(newSid);
    expect(raw).not.toMatch(/sid|currentSessionId/i);
  });

  it('a missing sid claim (legacy/test token) is rejected, not silently waved through', async () => {
    const { teacher, quiz } = await createTeacherWithQuiz();
    await issueSessionId(teacher.id); // currentSessionId is set, but this token omits `sid` entirely
    const tokenWithoutSid = jwt.sign({ userId: teacher.id, role: teacher.role, email: teacher.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });

    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, tokenWithoutSid);
    expect(res.status).toBe(409);
  });

  it('an unauthenticated request still gets a plain 401, not 409', async () => {
    const { quiz } = await createTeacherWithQuiz();
    const res = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`);
    expect(res.status).toBe(401);
  });
});
