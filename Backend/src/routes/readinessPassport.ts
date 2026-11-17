/**
 * @fileoverview HTTP routes for 4-Pillar Pre-Exam Readiness Dossiers & Digital Skill Passports.
 * Delegates all business logic to `readinessScoringService` and `digitalPassportService`.
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdminRole, requireNotBannedOrDeleted } from '../middleware/auth';
import { requireCourseAccess, checkCourseAccess } from './courses/shared';
import { prisma } from '../lib/prisma';
import { rateLimit } from '../middleware/rateLimit';
import {
  getOrSyncCourseReadiness,
  evaluateSubmissionWithAi,
  recordAttendanceCheckpoint,
  recordLecturerEvaluation,
} from '../services/readinessScoringService';
import {
  getStudentDigitalPassport,
  getPublicDigitalPassportByCode,
} from '../services/digitalPassportService';
import { resolveStudentWorkspaceAccess } from '../services/workspaceAccessService';

const router = Router();
const evaluationLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 6, keyGenerator: (req) => req.user!.id });

router.get('/readiness/my/summary', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const enrollments = await prisma.courseEnrollment.findMany({ where: { userId: req.user!.id }, select: { courseId: true } });
  const records = await Promise.all(enrollments.map((e) => getOrSyncCourseReadiness(req.user!.id, e.courseId)));
  return res.json({ records: records.filter(Boolean), threshold: 90 });
});

router.get('/readiness/:courseId', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const result = await getOrSyncCourseReadiness(req.user!.id, req.params.courseId);
  if (!result) return res.status(404).json({ message: 'Course not found' });
  return res.json(result);
});

router.post('/readiness/:courseId/ai-evaluate', authenticate, requireCourseAccess, evaluationLimit, async (req: Request, res: Response) => {
  try {
    const result = await evaluateSubmissionWithAi({ userId: req.user!.id, courseId: req.params.courseId });
    if (!result) return res.status(404).json({ message: 'Course not found' });
    return res.json(result);
  } catch (error) {
    console.error('[readiness] AI evaluation failed:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(502).json({ message: 'AI evaluation is unavailable. Please try again.' });
  }
});

router.post('/readiness/:courseId/attendance-ping', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const result = await recordAttendanceCheckpoint(
    req.user!.id,
    req.params.courseId,
    Boolean(req.body?.checkpointPassed)
  );
  return res.json(result);
});

router.post('/readiness/:courseId/lecturer-grade', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const { studentId, lecturerScore, lecturerNote } = req.body as {
    studentId?: string;
    lecturerScore?: number;
    lecturerNote?: string;
  };
  if (typeof studentId !== 'string' || !studentId || typeof lecturerScore !== 'number' || !Number.isFinite(lecturerScore) || lecturerScore < 0 || lecturerScore > 100 || (lecturerNote != null && typeof lecturerNote !== 'string')) {
    return res.status(400).json({ message: 'studentId and lecturerScore are required' });
  }
  const access = await checkCourseAccess(studentId, req.params.courseId);
  if (!access.allowed) return res.status(403).json({ message: 'Student is not enrolled in this course.' });
  const result = await recordLecturerEvaluation({
    studentId,
    courseId: req.params.courseId,
    lecturerScore,
    lecturerNote,
    lecturerName: req.user!.email,
    lecturerEvaluatedById: req.user!.id,
  });
  if (!result) return res.status(404).json({ message: 'Course not found' });
  return res.json(result);
});

router.get('/passport/me', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const payload = await getStudentDigitalPassport(req.user!.id);
  if (!payload) return res.status(404).json({ message: 'Student not found' });
  return res.json(payload);
});

router.get('/passport/public/:code', async (req: Request, res: Response) => {
  const payload = await getPublicDigitalPassportByCode(req.params.code);
  if (!payload) return res.status(404).json({ message: 'Digital Passport not found' });
  return res.json(payload);
});

router.get('/workspace-access', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const access = await resolveStudentWorkspaceAccess(req.user!.id);
  return res.json(access);
});

export default router;
