import 'express-async-errors';
import express, { ErrorRequestHandler } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { prisma } from '../../lib/prisma';
import { createUser } from '../../test/factories';
import examProctoringRouter from '../examProctoring';

// AI calls are never reached in these tests (MCQ-only exam, no open
// questions to grade) — mocked anyway so nothing can hit a real provider.
jest.mock('../../services/examProctoringService', () => {
  const actual = jest.requireActual('../../services/examProctoringService');
  return {
    ...actual,
    gradePracticalAnswer: jest.fn(),
    estimateAiTextScore: jest.fn(),
    generateAdaptiveStudyGuide: jest.fn().mockResolvedValue({ guideText: 'Review the material.' }),
  };
});

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/exam-proctoring', examProctoringRouter);
  app.use(((error, _req, res, _next) => {
    res.status(500).json({ message: error.message });
  }) as ErrorRequestHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await prisma.$disconnect();
});

const QUESTION_COUNT = 15;

async function createExam() {
  const teacher = await createUser();
  return prisma.examSession.create({
    data: {
      businessId: teacher.id,
      title: 'Classroom test',
      topic: 'Biology',
      mcqCount: QUESTION_COUNT,
      durationMinutes: 30,
      questions: {
        create: Array.from({ length: QUESTION_COUNT }, (_, i) => ({
          order: i,
          type: 'MCQ' as const,
          question: `Question ${i}`,
          options: { A: `right-${i}`, B: `wrong1-${i}`, C: `wrong2-${i}`, D: `wrong3-${i}` },
          correctAnswer: 'A',
        })),
      },
    },
  });
}

// Every request comes from the same classroom IP.
const CLASSROOM_IP = '203.0.113.10';
async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/exam-proctoring${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': CLASSROOM_IP },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

type CandidateQuestion = { id: string; question: string; options: Record<string, string> };

describe('AI proctored exam — classroom flow', () => {
  it('lets a whole class on one IP start and submit, with a different layout per student, scored correctly', async () => {
    const exam = await createExam();
    const layouts: string[] = [];
    const STUDENTS = 30;

    for (let s = 0; s < STUDENTS; s++) {
      const info = await call('GET', `/candidate/${exam.candidateToken}`);
      expect(info.status).toBe(200);
      const start = await call('POST', `/candidate/${exam.candidateToken}/start`, {
        candidateName: `Student ${s}`,
        candidateEmail: `student${s}@school.test`,
      });
      expect(start.status).toBe(201);
      const questions: CandidateQuestion[] = start.body.data.questions;
      expect(questions).toHaveLength(QUESTION_COUNT);
      layouts.push(questions.map((q) => `${q.id}:${q.options.A}`).join('|'));

      // Every student answers everything correctly by picking whichever
      // displayed letter shows the "right-" option in THEIR layout.
      const answers: Record<string, string> = {};
      for (const q of questions) {
        answers[q.id] = Object.entries(q.options).find(([, text]) => text.startsWith('right-'))![0];
      }
      const submit = await call('POST', `/submissions/${start.body.data.submissionToken}/submit`, { answers });
      expect(submit.status).toBe(200);

      const stored = await prisma.examSubmission.findUnique({ where: { candidateToken: start.body.data.submissionToken } });
      expect(stored!.mcqScore).toBe(100);
      // Stored answers use the canonical letters, so the teacher's report lines up.
      expect(Object.values(stored!.answers as Record<string, string>).every((a) => a === 'A')).toBe(true);
    }

    // Practically every student sees a different layout.
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(STUDENTS - 1);
  });

  it('scores a wrong pick as wrong even though letters are shuffled', async () => {
    const exam = await createExam();
    const start = await call('POST', `/candidate/${exam.candidateToken}/start`, { candidateName: 'S', candidateEmail: 's@school.test' });
    const questions: CandidateQuestion[] = start.body.data.questions;
    const answers: Record<string, string> = {};
    questions.forEach((q, i) => {
      const wantRight = i < 6; // 6 of 15 correct = 40%
      answers[q.id] = Object.entries(q.options).find(([, text]) => text.startsWith('right-') === wantRight)![0];
    });
    await call('POST', `/submissions/${start.body.data.submissionToken}/submit`, { answers });
    const stored = await prisma.examSubmission.findUnique({ where: { candidateToken: start.body.data.submissionToken } });
    expect(stored!.mcqScore).toBe(40);
  });

  it('resume returns the same layout and the remaining time', async () => {
    const exam = await createExam();
    const start = await call('POST', `/candidate/${exam.candidateToken}/start`, { candidateName: 'S', candidateEmail: 's@school.test' });
    const resume = await call('GET', `/submissions/${start.body.data.submissionToken}/resume`);
    expect(resume.status).toBe(200);
    expect(resume.body.data.questions).toEqual(start.body.data.questions);
    expect(resume.body.data.secondsLeft).toBeGreaterThan(29 * 60);

    await call('POST', `/submissions/${start.body.data.submissionToken}/submit`, { answers: {} });
    const after = await call('GET', `/submissions/${start.body.data.submissionToken}/resume`);
    expect(after.status).toBe(409);
  });

  it('camera/mic signals lower integrity but do not flag the attempt; 3 tab switches do', async () => {
    const exam = await createExam();

    const soft = await call('POST', `/candidate/${exam.candidateToken}/start`, { candidateName: 'Soft', candidateEmail: 'soft@school.test' });
    for (const type of ['BACKGROUND_VOICE', 'BACKGROUND_VOICE', 'LOOKING_AWAY', 'FACE_MISSING', 'BACKGROUND_VOICE']) {
      expect((await call('POST', `/submissions/${soft.body.data.submissionToken}/events`, { type })).status).toBe(204);
    }
    await call('POST', `/submissions/${soft.body.data.submissionToken}/submit`, { answers: {} });
    const softRow = await prisma.examSubmission.findUnique({ where: { candidateToken: soft.body.data.submissionToken } });
    expect(softRow!.status).toBe('COMPLETED');
    expect(softRow!.cameraAudioViolations).toBe(5);
    expect(softRow!.integrityScore).toBe(90);

    const hard = await call('POST', `/candidate/${exam.candidateToken}/start`, { candidateName: 'Hard', candidateEmail: 'hard@school.test' });
    for (let i = 0; i < 3; i++) {
      await call('POST', `/submissions/${hard.body.data.submissionToken}/events`, { type: 'TAB_SWITCH' });
    }
    await call('POST', `/submissions/${hard.body.data.submissionToken}/submit`, { answers: {} });
    const hardRow = await prisma.examSubmission.findUnique({ where: { candidateToken: hard.body.data.submissionToken } });
    expect(hardRow!.status).toBe('FLAGGED');
  });
});
