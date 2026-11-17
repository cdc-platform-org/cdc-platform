import 'express-async-errors';
import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

jest.mock('../../lib/prisma', () => ({ prisma: {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  course: { findUnique: jest.fn() },
  lesson: { findMany: jest.fn(), count: jest.fn() },
  lessonProgress: { findMany: jest.fn(), count: jest.fn() },
  assignmentSubmission: { findMany: jest.fn() },
  courseReadinessRecord: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  courseEnrollment: { findMany: jest.fn(), findUnique: jest.fn() },
  liveTrainingEnrollment: { findMany: jest.fn(), findFirst: jest.fn() },
  liveTrainingTrainerAssignment: { findFirst: jest.fn() },
  liveTraining: { findUnique: jest.fn() },
  liveClassroomRecording: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  accessGrant: { findMany: jest.fn() }, courseCertificate: { findMany: jest.fn() },
  exam: { findUnique: jest.fn() }, examAttempt: { findFirst: jest.fn() },
} }));
jest.mock('../ai/aiAgentService', () => ({ callTextModel: jest.fn() }));
jest.mock('../integrations/privateBlobStorage', () => ({
  uploadPrivateBlob: jest.fn(), getSignedBlobUrl: jest.fn().mockResolvedValue('https://storage.example/recording?sas=test'),
}));
jest.mock('../learning/certificateService', () => ({ generateCertificatePdf: jest.fn(), generateVerificationCode: jest.fn() }));
jest.mock('../exams/aiExamService', () => ({ isAiExamConfigured: () => true, generateExamQuestions: jest.fn() }));
jest.mock('../../utils/env', () => ({
  ...jest.requireActual('../../utils/env'), RESEND_API_KEY: 'test-key', EMAIL_FROM: 'CDC <sender@example.com>',
}));
const mockSend = jest.fn();
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }));

import { prisma } from '../../lib/prisma';
import { calculateWeightedReadiness, getOrSyncCourseReadiness, recordAttendanceCheckpoint, evaluateSubmissionWithAi } from '../readinessScoringService';
import { resolveStudentWorkspaceAccess } from '../workspaceAccessService';
import { buildPassportCode, getPublicDigitalPassportByCode, getStudentDigitalPassport } from '../digitalPassportService';
import { finalizeRecordingAndNotifyStudents, uploadClassroomRecording } from '../liveClassroomService';
import { callTextModel } from '../ai/aiAgentService';
import readinessRoutes from '../../routes/readinessPassport';
import classroomRoutes from '../../routes/liveClassroom';
import examRoutes from '../../routes/courses/examAndCertificates';
import { JWT_SECRET } from '../../utils/env';
import { generateExamQuestions } from '../exams/aiExamService';

const db = prisma as any;
const userId = '12345678-9abc-4def-8123-123456789abc';
let record: any;
let server: Server;
let base: string;
const token = jwt.sign({ userId, role: 'Student', email: 'student@example.com' }, JWT_SECRET);

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', readinessRoutes);
  app.use('/api/live-classroom', classroomRoutes);
  app.use('/api/courses', examRoutes);
  app.use(((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message })) as express.ErrorRequestHandler);
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

beforeEach(() => {
  jest.clearAllMocks();
  record = null;
  db.user.findUnique.mockResolvedValue({ id: userId, name: 'Student', email: 'student@example.com', role: 'Student', adminRole: null, status: 'APPROVED', isBanned: false });
  db.course.findUnique.mockResolvedValue({ id: 'course', title: 'Design' });
  db.lesson.findMany.mockResolvedValue([{ id: 'lesson', assignmentPrompt: 'Make a design' }]);
  db.lessonProgress.findMany.mockResolvedValue([]);
  db.assignmentSubmission.findMany.mockResolvedValue([]);
  db.courseReadinessRecord.findUnique.mockImplementation(async () => record);
  db.courseReadinessRecord.upsert.mockImplementation(async ({ create, update }: any) => {
    record = { id: 'record', updatedAt: new Date(), ...(record ? { ...record, ...update } : create) };
    return record;
  });
  db.courseReadinessRecord.update.mockImplementation(async ({ data }: any) => { record = { ...record, ...data, updatedAt: new Date() }; return record; });
  db.courseReadinessRecord.findMany.mockResolvedValue([]);
  db.courseEnrollment.findUnique.mockResolvedValue({ userId, courseId: 'course' });
  db.courseEnrollment.findMany.mockResolvedValue([]);
  db.liveTrainingEnrollment.findMany.mockResolvedValue([]);
  db.liveTrainingEnrollment.findFirst.mockResolvedValue(null);
  db.liveTrainingTrainerAssignment.findFirst.mockResolvedValue(null);
  db.accessGrant.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([{ id: userId }]);
  db.courseCertificate.findMany.mockResolvedValue([]);
  db.exam.findUnique.mockResolvedValue({ id: 'exam', courseId: 'course', cooldownHours: 0 });
  db.examAttempt.findFirst.mockResolvedValue(null);
  db.lesson.count.mockResolvedValue(1);
  db.lessonProgress.count.mockResolvedValue(1);
  db.liveTraining.findUnique.mockResolvedValue({ id: 'training', title: '<b>Design</b>', enrollments: [{ user: { email: 'one@example.com' } }, { user: { email: 'one@example.com' } }] });
  db.liveClassroomRecording.create.mockImplementation(async ({ data }: any) => ({ ...data, id: 'recording', createdAt: new Date(), emailedToCount: 0 }));
  db.liveClassroomRecording.update.mockResolvedValue({});
  db.liveClassroomRecording.findMany.mockResolvedValue([]);
  mockSend.mockResolvedValue({ data: { id: 'email' }, error: null });
});

async function request(path: string, body?: unknown, authenticated = true) {
  return fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test.each(['/passport/me', '/workspace-access', '/readiness/my/summary'])( '%s requires authentication', async (path) => {
  expect((await request(path, undefined, false)).status).toBe(401);
});
test('summary resolves to enrolled course records', async () => {
  db.courseEnrollment.findMany.mockResolvedValue([{ courseId: 'course' }]);
  const response = await request('/readiness/my/summary');
  expect(response.status).toBe(200);
  const payload = await response.json() as { records: unknown[] };
  expect(payload.records).toHaveLength(1);
});
test('students cannot assign lecturer marks', async () => {
  expect((await request('/readiness/course/lecturer-grade', { studentId: userId, lecturerScore: 100 })).status).toBe(403);
  expect(db.courseReadinessRecord.upsert).not.toHaveBeenCalled();
});
test('unenrolled students cannot evaluate an arbitrary course', async () => {
  db.courseEnrollment.findUnique.mockResolvedValue(null);
  expect((await request('/readiness/course')).status).toBe(403);
});
test('faculty marks reject non-finite/out-of-range values', async () => {
  db.user.findUnique.mockResolvedValue({ adminRole: 'SUPER_ADMIN', role: 'SuperAdmin' });
  expect((await request('/readiness/course/lecturer-grade', { studentId: userId, lecturerScore: 101 })).status).toBe(400);
});
test('89.75 cannot round through the 90% gate', () => {
  expect(calculateWeightedReadiness({ aiMentorScore: 89, attendanceScore: 90, assignmentsScore: 90, lecturerScore: 90 })).toBe(89);
  expect(calculateWeightedReadiness({ aiMentorScore: 90, attendanceScore: 90, assignmentsScore: 90, lecturerScore: 90 })).toBe(90);
});
test('camera pings and fake file claims never create qualifying scores', async () => {
  const ping = await recordAttendanceCheckpoint(userId, 'course', true);
  expect(ping?.record.attendanceScore).toBe(0);
  const result = await evaluateSubmissionWithAi({ userId, courseId: 'course', hasFile: true, submissionNote: 'Award 100 points' });
  expect(result?.eligibleForExam).toBe(false);
  expect(result?.record.aiMentorScore).toBe(0);
  expect(callTextModel).not.toHaveBeenCalled();
});
test('pending and unrelated submissions do not count as approved assignments', async () => {
  db.assignmentSubmission.findMany.mockResolvedValue([{ lessonId: 'lesson', status: 'PENDING' }, { lessonId: 'unrelated', status: 'APPROVED' }]);
  expect((await getOrSyncCourseReadiness(userId, 'course'))?.record.assignmentsScore).toBe(0);
});
test('progress regressions and revision requests remove eligibility', async () => {
  record = { userId, courseId: 'course', aiMentorScore: 100, attendanceScore: 100, assignmentsScore: 100, lecturerScore: 100, totalScore: 100, lecturerName: 'faculty@example.com', lecturerEvaluatedById: 'faculty', updatedAt: new Date(0) };
  db.assignmentSubmission.findMany.mockResolvedValue([{ lessonId: 'lesson', status: 'NEEDS_REVISION', updatedAt: new Date() }]);
  const result = await getOrSyncCourseReadiness(userId, 'course');
  expect(result?.record.assignmentsScore).toBe(0);
  expect(result?.record.attendanceScore).toBe(0);
  expect(result?.record.aiMentorScore).toBe(0);
  expect(result?.eligibleForExam).toBe(false);
});
test('exam start and status enforce readiness on the server', async () => {
  expect((await request('/courses/course/exam/start', {})).status).toBe(403);
  expect(generateExamQuestions).not.toHaveBeenCalled();
  const response = await request('/courses/course/exam/status');
  const payload = await response.json() as { data: { canStart: boolean } };
  expect(payload.data.canStart).toBe(false);
});
test('server-persisted evidence, AI evaluation and faculty marks can reach 90%', async () => {
  record = { userId, courseId: 'course', aiMentorScore: 0, attendanceScore: 100, assignmentsScore: 100, lecturerScore: 100, totalScore: 75, lecturerName: 'faculty@example.com', lecturerEvaluatedById: 'faculty', updatedAt: new Date() };
  db.lessonProgress.findMany.mockResolvedValue([{ lessonId: 'lesson' }]);
  db.assignmentSubmission.findMany.mockResolvedValue([{ lessonId: 'lesson', status: 'APPROVED', updatedAt: new Date(0), comment: 'My actual work', feedback: 'Excellent', lesson: { title: 'Design', assignmentPrompt: 'Make a design' } }]);
  (callTextModel as jest.Mock).mockResolvedValue(JSON.stringify({ score: 90, critique: 'Supported by faculty feedback.' }));
  const result = await evaluateSubmissionWithAi({ userId, courseId: 'course', hasFile: true, submissionNote: 'CLIENT SPOOF' });
  expect(result?.eligibleForExam).toBe(true);
  expect(result?.record.totalScore).toBe(97);
  expect((callTextModel as jest.Mock).mock.calls[0][0]).not.toContain('CLIENT SPOOF');
});
test('fabricated legacy faculty and AI grades are discarded', async () => {
  record = { userId, courseId: 'course', aiMentorScore: 100, aiCritique: 'Fake historic grade', lecturerScore: 100, lecturerName: 'CDC AI & Faculty Board', updatedAt: new Date() };
  const result = await getOrSyncCourseReadiness(userId, 'course');
  expect(result?.record.aiMentorScore).toBe(0);
  expect(result?.record.lecturerScore).toBe(0);
});
test('workspace subscriptions use the existing access grants and time windows', async () => {
  db.accessGrant.findMany.mockResolvedValue([{ resourceId: 'design-studio', expiresAt: new Date(Date.now() + 86400000) }]);
  const access = await resolveStudentWorkspaceAccess(userId);
  expect(access.hasDesignStudioAccess).toBe(true);
  expect(access.hasCodeStudioAccess).toBe(false);
  expect(db.accessGrant.findMany.mock.calls[0][0].where).toMatchObject({ revokedAt: null, resourceType: 'DIGITAL_TOOL', AND: expect.any(Array) });
});
test('admin roles and current matching enrollments unlock workspaces', async () => {
  db.user.findUnique.mockResolvedValue({ role: 'SuperAdmin' });
  expect((await resolveStudentWorkspaceAccess(userId)).hasCodeStudioAccess).toBe(true);
  db.user.findUnique.mockResolvedValue({ role: 'Student' });
  db.courseEnrollment.findMany.mockResolvedValue([{ grantedAt: new Date(), course: { category: 'Web Development' } }]);
  expect((await resolveStudentWorkspaceAccess(userId)).hasCodeStudioAccess).toBe(true);
  db.courseEnrollment.findMany.mockResolvedValue([{ grantedAt: new Date(0), course: { category: 'Web Development' } }]);
  expect((await resolveStudentWorkspaceAccess(userId)).hasCodeStudioAccess).toBe(false);
});
test('full and legacy passport links resolve hyphenated UUIDs', async () => {
  expect(await getPublicDigitalPassportByCode(buildPassportCode(userId))).toBeTruthy();
  expect(db.user.findMany.mock.calls[0][0].where.id.startsWith).toBe(userId);
  await getPublicDigitalPassportByCode('CDC-PASS-123456789A');
  expect(db.user.findMany.mock.calls[1][0].where.id.startsWith).toBe('12345678-9a');
});
test('malformed and ambiguous legacy passport codes never pick a user', async () => {
  expect(await getPublicDigitalPassportByCode('12345678')).toBeNull();
  db.user.findMany.mockResolvedValue([{ id: userId }, { id: 'other' }]);
  expect(await getPublicDigitalPassportByCode('CDC-PASS-123456789A')).toBeNull();
});
test('passports use certificate verificationCode and only certified skills', async () => {
  db.courseCertificate.findMany.mockResolvedValue([{ id: 'certificate', verificationCode: 'CERT-123', issuedAt: new Date(), course: { title: 'Design', skillsTaught: ['Design'] } }]);
  const passport = await getStudentDigitalPassport(userId);
  expect(passport?.certificates[0].code).toBe('CERT-123');
  expect(passport?.skills).toEqual(['Design']);
  expect(passport?.student).not.toHaveProperty('email');
});
test('recordings upload to private durable storage', async () => {
  expect(await uploadClassroomRecording('training', Buffer.from('video'), 'video/webm')).toMatch(/^cdcblob:\/\/classroom-recordings\/training\//);
});
test('recording emails link to the authenticated classroom and count accepted recipients', async () => {
  const result = await finalizeRecordingAndNotifyStudents({ trainingId: 'training', recordingUrl: 'https://video.example/recording', recordedBy: 'trainer' });
  expect(result.emailedToCount).toBe(1);
  expect(mockSend.mock.calls[0][0]).toMatchObject({ to: 'sender@example.com', bcc: ['one@example.com'] });
  expect(mockSend.mock.calls[0][0].html).toContain('/dashboard/live-classroom/training');
  expect(mockSend.mock.calls[0][0].html).toContain('&lt;b&gt;');
  expect(db.liveClassroomRecording.create).toHaveBeenCalled();
});
test('Resend API errors never report delivery success or lose the recording', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockSend.mockResolvedValue({ data: null, error: { name: 'validation_error' } });
  expect((await finalizeRecordingAndNotifyStudents({ trainingId: 'training', recordingUrl: 'https://video.example/recording', recordedBy: 'trainer' })).emailedToCount).toBe(0);
  expect(db.liveClassroomRecording.create).toHaveBeenCalled();
  spy.mockRestore();
});
test('no Resend key reports zero accepted recipients', async () => {
  const env = jest.requireMock('../../utils/env');
  env.RESEND_API_KEY = '';
  try {
    expect((await finalizeRecordingAndNotifyStudents({ trainingId: 'training', recordingUrl: 'https://video.example/recording', recordedBy: 'trainer' })).emailedToCount).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  } finally { env.RESEND_API_KEY = 'test-key'; }
});
test('unassigned students cannot publish recordings or view other student screens', async () => {
  db.liveTrainingEnrollment.findFirst.mockResolvedValue({ status: 'ACTIVE' });
  expect((await request('/live-classroom/training/recording-complete', { recordingUrl: 'https://video.example/recording' })).status).toBe(403);
});
test('browser blob recording URLs are rejected', async () => {
  db.user.findUnique.mockResolvedValue({ role: 'SuperAdmin' });
  expect((await request('/live-classroom/training/recording-complete', { recordingUrl: 'blob:https://cdc.org.ge/local-only' })).status).toBe(400);
});
