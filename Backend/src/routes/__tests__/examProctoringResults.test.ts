import 'express-async-errors';
import express, { ErrorRequestHandler } from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { prisma } from '../../lib/prisma';
import { createUser } from '../../test/factories';
import examProctoringRouter from '../examProctoring';
import { generateMcqExplanations } from '../../services/examProctoringService';
import { sendExamResultsEmail, buildExamResultsEmailHtml } from '../../services/emailService';

jest.mock('../../services/examProctoringService', () => {
  const actual = jest.requireActual('../../services/examProctoringService');
  return {
    ...actual,
    gradePracticalAnswer: jest.fn().mockResolvedValue({ score: 60, feedback: 'Good start, but mention photosynthesis.' }),
    estimateAiTextScore: jest.fn().mockResolvedValue({ score: 10 }),
    generateAdaptiveStudyGuide: jest.fn().mockResolvedValue({ guideText: 'Review the material.' }),
    generateMcqExplanations: jest.fn(),
  };
});
jest.mock('../../services/emailService', () => ({
  ...jest.requireActual('../../services/emailService'),
  sendExamResultsEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockedExplanations = generateMcqExplanations as jest.MockedFunction<typeof generateMcqExplanations>;
const mockedSendEmail = sendExamResultsEmail as jest.MockedFunction<typeof sendExamResultsEmail>;

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

beforeEach(() => {
  mockedExplanations.mockReset();
  mockedSendEmail.mockClear();
});

async function createExam(opts: { showResults?: boolean; withExplanations?: boolean; withPractical?: boolean } = {}) {
  const teacher = await createUser();
  const mcq = Array.from({ length: 4 }, (_, i) => ({
    order: i,
    type: 'MCQ' as const,
    question: `Question ${i}`,
    options: { A: `right-${i}`, B: `wrong1-${i}`, C: `wrong2-${i}`, D: `wrong3-${i}` },
    correctAnswer: 'A',
    explanation: opts.withExplanations === false ? null : `Because right-${i} is right.`,
  }));
  const open = opts.withPractical
    ? [{ order: 4, type: 'PRACTICAL' as const, question: 'Explain plants.', correctAnswer: 'Mentions photosynthesis.', explanation: null }]
    : [];
  return prisma.examSession.create({
    data: {
      businessId: teacher.id,
      title: 'Biology quiz',
      topic: 'Biology',
      mcqCount: 4,
      durationMinutes: 30,
      showResultsToCandidate: opts.showResults ?? true,
      questions: { create: [...mcq, ...open] },
    },
  });
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}/exam-proctoring${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

type CandidateQuestion = { id: string; type: string; options: Record<string, string> | null };

// Answers the first `rightCount` MCQs correctly (in the student's own
// layout) and the rest wrong; writes text for open questions.
async function takeExam(examToken: string, rightCount: number, locale?: string) {
  const start = await call('POST', `/candidate/${examToken}/start`, { candidateName: 'Nino Beridze', candidateEmail: 'nino@school.test' });
  const questions: CandidateQuestion[] = start.body.data.questions;
  const answers: Record<string, string> = {};
  let mcqIndex = 0;
  for (const q of questions) {
    if (q.type !== 'MCQ') {
      answers[q.id] = 'Plants make food from light.';
      continue;
    }
    const wantRight = mcqIndex++ < rightCount;
    answers[q.id] = Object.entries(q.options!).find(([, text]) => text.startsWith('right-') === wantRight)![0];
  }
  const submit = await call('POST', `/submissions/${start.body.data.submissionToken}/submit`, { answers, locale });
  return { start, questions, answers, submit, submissionToken: start.body.data.submissionToken as string };
}

describe('AI proctored exam — results for the student', () => {
  it('returns score, every answer in the student\'s own layout, and explanations; emails the same', async () => {
    const exam = await createExam();
    const { submit, questions, answers, submissionToken } = await takeExam(exam.candidateToken, 3);

    expect(submit.status).toBe(200);
    const results = submit.body.data.results;
    expect(results.totalScore).toBe(75);
    expect(results.correctCount).toBe(3);
    expect(results.mcqTotal).toBe(4);
    expect(results.candidateName).toBe('Nino Beridze');
    expect(results.questions).toHaveLength(4);

    // Same order and letters as the student saw.
    results.questions.forEach((r: any, i: number) => {
      const shown = questions[i];
      expect(r.options).toEqual(shown.options);
      expect(r.candidateAnswer).toBe(answers[shown.id]);
      expect(r.options[r.correctAnswer]).toMatch(/^right-/);
      expect(r.isCorrect).toBe(r.candidateAnswer === r.correctAnswer);
      expect(r.explanation).toMatch(/^Because right-\d is right\.$/);
    });
    expect(results.questions.filter((r: any) => r.isCorrect)).toHaveLength(3);

    // Email goes to the address typed before the exam, in Georgian by default.
    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const email = mockedSendEmail.mock.calls[0][0];
    expect(email.to).toBe('nino@school.test');
    expect(email.locale).toBe('ka');
    expect(email.totalScore).toBe(75);
    expect(email.resultsUrl).toBe(`https://cdc.org.ge/exam/result/${submissionToken}`);
    expect(email.questions).toEqual(results.questions);

    // The results page shows the same thing later.
    const page = await call('GET', `/submissions/${submissionToken}/results`);
    expect(page.status).toBe(200);
    expect(page.body.data.questions).toEqual(results.questions);
  });

  it('sends the email in English when the exam page was in English', async () => {
    const exam = await createExam();
    const { submissionToken } = await takeExam(exam.candidateToken, 4, 'en');
    const email = mockedSendEmail.mock.calls[0][0];
    expect(email.locale).toBe('en');
    expect(email.resultsUrl).toBe(`https://cdc.org.ge/en/exam/result/${submissionToken}`);
  });

  it('includes open-question score, AI feedback and the expected answer', async () => {
    const exam = await createExam({ withPractical: true });
    const { submit } = await takeExam(exam.candidateToken, 4);
    const open = submit.body.data.results.questions.find((q: any) => q.type === 'PRACTICAL');
    expect(open.candidateAnswer).toBe('Plants make food from light.');
    expect(open.aiScore).toBe(60);
    expect(open.aiFeedback).toMatch(/photosynthesis/);
    expect(open.expectedAnswer).toBe('Mentions photosynthesis.');
    // (100 MCQ + 60 open) / 2
    expect(submit.body.data.results.totalScore).toBe(80);
  });

  it('fills in missing explanations once (older exams) and stores them', async () => {
    const exam = await createExam({ withExplanations: false });
    const rows = await prisma.examQuestion.findMany({ where: { examSessionId: exam.id } });
    mockedExplanations.mockResolvedValue(Object.fromEntries(rows.map((q) => [q.id, `AI explains ${q.question}`])));

    const first = await takeExam(exam.candidateToken, 2);
    expect(first.submit.body.data.results.questions.every((q: any) => /^AI explains Question \d$/.test(q.explanation))).toBe(true);
    expect(mockedExplanations).toHaveBeenCalledTimes(1);

    const stored = await prisma.examQuestion.findMany({ where: { examSessionId: exam.id } });
    expect(stored.every((q) => q.explanation?.startsWith('AI explains'))).toBe(true);

    // Next student: no new AI call.
    await takeExam(exam.candidateToken, 1);
    expect(mockedExplanations).toHaveBeenCalledTimes(1);
  });

  it('still returns results (without explanations) when the AI call fails', async () => {
    const exam = await createExam({ withExplanations: false });
    mockedExplanations.mockRejectedValue(new Error('AI down'));
    const { submit } = await takeExam(exam.candidateToken, 2);
    expect(submit.status).toBe(200);
    expect(submit.body.data.results.totalScore).toBe(50);
    expect(submit.body.data.results.questions.every((q: any) => q.explanation === null)).toBe(true);
  });

  it('shows nothing and sends no email when the teacher turned results off', async () => {
    const exam = await createExam({ showResults: false });
    const info = await call('GET', `/candidate/${exam.candidateToken}`);
    expect(info.body.data.showResultsToCandidate).toBe(false);

    const { submit, submissionToken } = await takeExam(exam.candidateToken, 4);
    expect(submit.status).toBe(200);
    expect(submit.body.data.results).toBeNull();
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect((await call('GET', `/submissions/${submissionToken}/results`)).status).toBe(403);
  });

  it('does not show results before the attempt is submitted', async () => {
    const exam = await createExam();
    const start = await call('POST', `/candidate/${exam.candidateToken}/start`, { candidateName: 'S', candidateEmail: 's@school.test' });
    expect((await call('GET', `/submissions/${start.body.data.submissionToken}/results`)).status).toBe(409);
    expect((await call('GET', `/submissions/not-a-real-token/results`)).status).toBe(404);
  });
});

describe('results email HTML', () => {
  it('escapes student and AI text', () => {
    const html = buildExamResultsEmailHtml({
      to: 'x@y.z',
      locale: 'ka',
      examTitle: '<b>Quiz</b>',
      candidateName: '<script>alert(1)</script>',
      totalScore: 50,
      correctCount: 1,
      mcqTotal: 2,
      flagged: false,
      resultsUrl: 'https://cdc.org.ge/exam/result/t',
      questions: [
        {
          number: 1,
          type: 'MCQ',
          question: 'Is <img src=x> safe?',
          options: { A: 'no', B: 'yes', C: 'maybe', D: '<i>x</i>' },
          candidateAnswer: 'B',
          correctAnswer: 'A',
          isCorrect: false,
          explanation: 'Because <tags> are escaped.',
          aiScore: null,
          aiFeedback: null,
          expectedAnswer: null,
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('B. yes');
    expect(html).toContain('A. no');
    expect(html).toContain('50%');
  });
});
