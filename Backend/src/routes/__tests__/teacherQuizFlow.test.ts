import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import educatorHubRoutes from '../educatorHub';
import teacherQuizRoutes from '../teacherQuiz';
import { errorHandler } from '../../middleware/errorHandler';
import { callTextModel } from '../../services/aiAgentService';
import { issueSessionId } from '../../services/educatorVipService';

// Fix D9 test infra note: this file previously made a REAL callTextModel
// call (no mock) for its FREE_TEXT "Paris" question — GEMINI_API_KEY is a
// dummy value in tests (setupEnv.ts), but Backend/.env's real
// AZURE_OPENAI_* vars are NOT overridden there and would leak through as
// aiAgentService's primary provider, meaning this suite was silently
// making a real, billed Azure OpenAI call on every run. Mocked here now,
// bringing this file in line with setupEnv.ts's own stated convention
// ("every AI-provider-calling function is mocked at its own module
// boundary") and making D9's exact-call-count assertions below possible at
// all (a real network call's count/timing can't be asserted on
// deterministically). The default mock reproduces the same "Paris is
// correct" verdict the real call apparently already returned, so the
// pre-existing test's score=67 assertion is unchanged.
jest.mock('../../services/aiAgentService', () => ({
  ...jest.requireActual('../../services/aiAgentService'),
  callTextModel: jest.fn(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/educator-hub', educatorHubRoutes);
  app.use('/api/quiz', teacherQuizRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

// Order matters: clearAllMocks() first (wipes call history AND any
// implementation from the previous test), then re-arm the default
// implementation every test can rely on unless it overrides it locally.
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(callTextModel).mockResolvedValue(JSON.stringify({ correct: true, feedback: 'Good answer!' }));
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

// D7: requireCurrentEducatorSession now actually enforces the token's
// `sid` claim against User.currentSessionId, so a test token needs a
// real, current sid — issueSessionId is what a real login mints one with
// (see routes/auth.ts's signToken), so calling it here before signing
// simulates "this user just logged in" rather than weakening the
// middleware to keep old sid-less tokens passing. Student-facing
// unauthenticated calls (user is undefined) are unaffected.
async function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const sid = user && (await issueSessionId(user.id));
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email, sid }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `198.18.6.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function data<T>(response: Response): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}

describe('teacher quiz result pipeline', () => {
  it('stores student answers and exposes a teacher-owned details payload for the submitted quiz', async () => {
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const quiz = await prisma.teacherQuiz.create({
      data: {
        teacherId: teacher.id,
        title: 'Quiz A',
        language: 'en',
        questions: {
          create: [
            { order: 0, type: 'MULTIPLE_CHOICE', question: '2 + 2?', options: { A: '3', B: '4', C: '5' }, correctAnswer: 'B' },
            { order: 1, type: 'FREE_TEXT', question: 'State the capital of France.', correctAnswer: 'Paris' },
            { order: 2, type: 'MULTIPLE_CHOICE', question: 'Capital of Georgia?', options: { A: 'Paris', B: 'Tbilisi', C: 'Rome' }, correctAnswer: 'B' },
          ],
        },
      },
      include: { questions: true },
    });

    const questionIds = Object.fromEntries(quiz.questions.map((q) => [q.id, q.id]));
    const studentAnswers = {
      [quiz.questions[0].id]: 'B',
      [quiz.questions[1].id]: 'Paris',
      [quiz.questions[2].id]: '',
    };

    const submitResponse = await request(`/api/quiz/${quiz.shareToken}/submit`, undefined, 'POST', {
      studentName: 'Student A',
      answers: studentAnswers,
    });
    expect(submitResponse.status).toBe(200);
    const submission = await data<{ id: string; score: number; results: Array<{ questionId: string; correct: boolean }> }>(submitResponse);
    expect(submission.score).toBe(67);
    expect(submission.results).toHaveLength(3);

    const summaryResponse = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions`, teacher);
    expect(summaryResponse.status).toBe(200);
    const summary = await data<Array<{ id: string; studentName: string; score: number }>>(summaryResponse);
    expect(summary).toHaveLength(1);
    expect(summary[0].studentName).toBe('Student A');
    expect(summary[0].score).toBe(67);

    const detailResponse = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${summary[0].id}`, teacher);
    expect(detailResponse.status).toBe(200);

    const detail = await data<{
      submission: { id: string; studentName: string; score: number; submittedAt: string };
      questions: Array<{ id: string; question: string; studentAnswer: string; correctAnswer: string; correct: boolean | null; answerStatus: 'correct' | 'incorrect' | 'unanswered' }>; 
    }>(detailResponse);

    expect(detail.submission.studentName).toBe('Student A');
    expect(detail.questions).toHaveLength(3);
    expect(detail.questions[0].studentAnswer).toBe('B');
    expect(detail.questions[0].correct).toBe(true);
    expect(detail.questions[2].answerStatus).toBe('unanswered');
    expect(detail.questions[2].studentAnswer).toBe('');
    expect(questionIds[detail.questions[0].id]).toBe(detail.questions[0].id);
  });

  it('rejects a teacher who does not own the quiz from reading another teacher\'s submission details', async () => {
    const teacherA = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const teacherB = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const quiz = await prisma.teacherQuiz.create({
      data: {
        teacherId: teacherA.id,
        title: 'Quiz B',
        language: 'en',
        questions: {
          create: [
            { order: 0, type: 'MULTIPLE_CHOICE', question: 'Q?', options: { A: '1', B: '2' }, correctAnswer: 'A' },
          ],
        },
      },
      include: { questions: true },
    });

    const submission = await prisma.teacherQuizSubmission.create({
      data: {
        quizId: quiz.id,
        studentName: 'Student B',
        answers: { [quiz.questions[0].id]: 'A' },
        score: 100,
      },
    });

    const response = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${submission.id}`, teacherB);
    expect(response.status).toBe(404);
  });
});

// Fix D9 — free-text AI grading persisted once at submission time, never
// recomputed just because a teacher reopens the submission detail view.
describe('D9 — persisted free-text grading', () => {
  async function createSingleFreeTextQuiz() {
    const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const quiz = await prisma.teacherQuiz.create({
      data: {
        teacherId: teacher.id,
        title: 'D9 Quiz',
        language: 'en',
        questions: { create: [{ order: 0, type: 'FREE_TEXT', question: 'Capital of France?', correctAnswer: 'Paris' }] },
      },
      include: { questions: true },
    });
    return { teacher, quiz, questionId: quiz.questions[0].id };
  }

  it('grades once at submission and reuses the persisted verdict on every later detail view (no re-grading call)', async () => {
    const { teacher, quiz, questionId } = await createSingleFreeTextQuiz();

    const submitResponse = await request(`/api/quiz/${quiz.shareToken}/submit`, undefined, 'POST', {
      studentName: 'Student A',
      answers: { [questionId]: 'Paris' },
    });
    expect(submitResponse.status).toBe(200);
    expect(callTextModel).toHaveBeenCalledTimes(1);

    const submissionId = (await data<{ submissionId: string }>(submitResponse)).submissionId;

    const firstDetail = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${submissionId}`, teacher);
    const firstBody = await data<{ questions: Array<{ correct: boolean; feedback?: string }> }>(firstDetail);
    expect(callTextModel).toHaveBeenCalledTimes(1); // unchanged — read from the persisted record, not re-graded

    const secondDetail = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${submissionId}`, teacher);
    const secondBody = await data<{ questions: Array<{ correct: boolean; feedback?: string }> }>(secondDetail);
    expect(callTextModel).toHaveBeenCalledTimes(1); // still unchanged after a second view

    expect(secondBody.questions[0].correct).toBe(firstBody.questions[0].correct);
    expect(secondBody.questions[0].feedback).toBe(firstBody.questions[0].feedback);

    const stored = await prisma.teacherQuizSubmission.findUnique({ where: { id: submissionId } });
    expect(stored?.gradingResults).toEqual([{ questionId, correct: true, feedback: 'Good answer!', gradingFailed: false }]);
  });

  it('does not persist a fake successful verdict when AI grading fails at submission time', async () => {
    jest.mocked(callTextModel).mockRejectedValue(new Error('simulated AI provider outage'));
    const { quiz, questionId } = await createSingleFreeTextQuiz();

    const submitResponse = await request(`/api/quiz/${quiz.shareToken}/submit`, undefined, 'POST', {
      studentName: 'Student A',
      answers: { [questionId]: 'Paris' },
    });
    expect(submitResponse.status).toBe(200); // one question's grading hiccup must not fail the whole submission
    const submissionId = (await data<{ submissionId: string }>(submitResponse)).submissionId;

    const stored = await prisma.teacherQuizSubmission.findUnique({ where: { id: submissionId } });
    const gradingResults = stored?.gradingResults as Array<{ questionId: string; correct: boolean; gradingFailed?: boolean }>;
    expect(gradingResults[0].gradingFailed).toBe(true);
    expect(gradingResults[0].correct).toBe(false); // never a fabricated "correct" verdict on failure
  });

  it('historical submissions with no persisted grading are graded once on first detail view and reused on the next (no duplicate AI call)', async () => {
    const { teacher, quiz, questionId } = await createSingleFreeTextQuiz();
    // Bypasses submitTeacherQuiz entirely — simulates a real pre-existing
    // row from before gradingResults existed (created with the exact same
    // shape the previous test file already used for its own fixture, minus
    // the new field).
    const submission = await prisma.teacherQuizSubmission.create({
      data: { quizId: quiz.id, studentName: 'Legacy Student', answers: { [questionId]: 'Paris' }, score: 100 },
    });
    expect(submission.gradingResults).toBeNull();

    const firstDetail = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${submission.id}`, teacher);
    expect(firstDetail.status).toBe(200);
    expect(callTextModel).toHaveBeenCalledTimes(1); // the one-time lazy grade

    const firstBody = await data<{ questions: Array<{ correct: boolean }> }>(firstDetail);
    expect(firstBody.questions[0].correct).toBe(true);

    const persisted = await prisma.teacherQuizSubmission.findUnique({ where: { id: submission.id } });
    expect(persisted?.gradingResults).not.toBeNull();

    const secondDetail = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${submission.id}`, teacher);
    expect(callTextModel).toHaveBeenCalledTimes(1); // still just the one call — second view reused the persisted result
    const secondBody = await data<{ questions: Array<{ correct: boolean } > }>(secondDetail);
    expect(secondBody.questions[0].correct).toBe(firstBody.questions[0].correct);
  });

  it('teacher ownership protection still applies to the historical lazy-grading path', async () => {
    const { quiz, questionId } = await createSingleFreeTextQuiz();
    const otherTeacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
    const submission = await prisma.teacherQuizSubmission.create({
      data: { quizId: quiz.id, studentName: 'Legacy Student', answers: { [questionId]: 'Paris' }, score: 100 },
    });

    const response = await request(`/api/educator-hub/quizzes/${quiz.id}/submissions/${submission.id}`, otherTeacher);
    expect(response.status).toBe(404);
    expect(callTextModel).not.toHaveBeenCalled(); // never even attempts grading for a non-owner
  });
});

// Regression (unchanged by this batch, re-verified per Fix Batch 2's own
// required checklist): the public, no-login quiz-fetch route must never
// expose the answer key.
describe('Regression — public quiz answer-key protection', () => {
  it('GET /api/quiz/:shareToken never includes correctAnswer', async () => {
    const { quiz } = await (async () => {
      const teacher = await createUser({ educatorVipActive: true, role: 'Mentor' });
      const q = await prisma.teacherQuiz.create({
        data: {
          teacherId: teacher.id,
          title: 'Regression Quiz',
          language: 'en',
          questions: { create: [{ order: 0, type: 'MULTIPLE_CHOICE', question: '2+2?', options: { A: '3', B: '4' }, correctAnswer: 'B' }] },
        },
      });
      return { quiz: q };
    })();

    const response = await request(`/api/quiz/${quiz.shareToken}`, undefined, 'GET');
    expect(response.status).toBe(200);
    const raw = await response.text();
    expect(raw).not.toContain('correctAnswer');
  });
});
