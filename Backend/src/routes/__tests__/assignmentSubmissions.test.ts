import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_SECRET } from '../../utils/env';
import { createUser } from '../../test/factories';
import coursesRouter from '../courses';
import { errorHandler } from '../../middleware/errorHandler';
import { getSignedBlobUrl } from '../../services/privateBlobStorage';
import { isPrivateSubmissionRef } from '../../services/assignmentSubmissionDelivery';

// courses.ts pulls in a wide surface (AI exam generation, subtitles,
// certificates, content moderation) that none of the routes under test here
// ever invoke — only the module that constructs an Azure client at import
// time (privateBlobStorage.ts, via assignmentSubmissionDelivery.ts) needs
// mocking to avoid a real network attempt, same reasoning as iako.test.ts.
jest.mock('../../services/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn().mockResolvedValue(undefined),
  getSignedBlobUrl: jest.fn().mockImplementation(async (blobName: string, expiryMinutes = 15) => `https://test-blob.example.test/${blobName}?sig=test&exp=${expiryMinutes}`),
  deletePrivateBlob: jest.fn().mockResolvedValue(undefined),
  privateBlobExists: jest.fn().mockResolvedValue(true),
  assertPrivateBlobContainer: jest.fn().mockResolvedValue(undefined),
  privateContainerReady: Promise.resolve(),
}));

type User = Awaited<ReturnType<typeof createUser>>;
let server: Server;
let baseUrl: string;
let requestNumber = 0;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/courses', coursesRouter);
  app.use(errorHandler);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => jest.clearAllMocks());
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await prisma.$disconnect();
});

function request(path: string, user?: User, method = 'GET', body?: unknown) {
  const token = user && jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.18.5.${++requestNumber}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function data<T>(response: Response): Promise<T> {
  return (await response.json() as { data: T }).data;
}

const SUBMISSION_BYTES = Array.from(Buffer.from('this is a homework submission file'));

async function uploadSubmissionFile(lessonId: string, user: User) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(SUBMISSION_BYTES)], { type: 'application/pdf' }), 'homework.pdf');
  const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
  return fetch(`${baseUrl}/courses/lessons/${lessonId}/submissions/upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': `198.18.5.${++requestNumber}` }, body: form,
  });
}

async function courseFixture() {
  const course = await prisma.course.create({ data: { title: 'Test Course', description: 'A course used for submission tests.', category: 'Engineering', lessons: [], originalPrice: 0 } });
  const section = await prisma.courseSection.create({ data: { courseId: course.id, title: 'Section 1', order: 1 } });
  const lesson = await prisma.lesson.create({ data: { sectionId: section.id, title: 'Lesson 1', order: 1 } });
  return { course, section, lesson };
}

async function submittedFixture() {
  const { course, lesson } = await courseFixture();
  const student = await createUser();
  await prisma.courseEnrollment.create({ data: { userId: student.id, courseId: course.id } });
  const uploadResp = await uploadSubmissionFile(lesson.id, student);
  const { url } = await data<{ url: string }>(uploadResp);
  const submitResp = await request(`/courses/lessons/${lesson.id}/submissions`, student, 'POST', { fileUrl: url });
  const submission = await data<{ id: string }>(submitResp);
  return { course, lesson, student, url, submissionId: submission.id };
}

describe('Assignment submission file storage', () => {
  it('14. a new submission upload stores a private Azure reference, not a public URL', async () => {
    const { lesson } = await courseFixture();
    const student = await createUser();
    const response = await uploadSubmissionFile(lesson.id, student);
    expect(response.status).toBe(201);
    const { url } = await data<{ url: string }>(response);
    expect(isPrivateSubmissionRef(url)).toBe(true);
    expect(url).not.toMatch(/^https?:\/\//);
  });

  it('11. the owning student can access their own submission document', async () => {
    const { lesson, student } = await submittedFixture();
    const response = await request(`/courses/lessons/${lesson.id}/submissions/mine/document`, student);
    expect(response.status).toBe(200);
    const { url } = await data<{ url: string }>(response);
    expect(url).toContain('sig=test');
    expect(getSignedBlobUrl).toHaveBeenCalled();
  });

  it('12. an admin can access a student\'s submission document for grading', async () => {
    const { submissionId } = await submittedFixture();
    const admin = await createUser({ adminRole: 'MANAGER' });
    const response = await request(`/courses/admin/submissions/${submissionId}/document`, admin);
    expect(response.status).toBe(200);
    const { url } = await data<{ url: string }>(response);
    expect(url).toContain('sig=test');
  });

  it('13. an unrelated learner cannot access another student\'s submission document', async () => {
    const { lesson, submissionId } = await submittedFixture();
    const outsider = await createUser();

    // The self endpoint has no id parameter at all — it always resolves the
    // CALLER's own submission, so an outsider hitting it for this lesson
    // gets nothing (they have no submission of their own here), never the
    // real student's file.
    const selfAttempt = await request(`/courses/lessons/${lesson.id}/submissions/mine/document`, outsider);
    expect(selfAttempt.status).toBe(404);

    // Directly guessing the grading-side endpoint is rejected for not being an admin.
    const adminAttempt = await request(`/courses/admin/submissions/${submissionId}/document`, outsider);
    expect(adminAttempt.status).toBe(403);
  });
});
