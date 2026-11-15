/**
 * @fileoverview HTTP routes for 4-Pillar Pre-Exam Readiness Dossiers & Digital Skill Passports.
 * Delegates all business logic to `readinessScoringService` and `digitalPassportService`.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
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

const router = Router();

router.get('/readiness/:courseId', authenticate, async (req: Request, res: Response) => {
  const result = await getOrSyncCourseReadiness(req.user!.id, req.params.courseId);
  if (!result) return res.status(404).json({ message: 'Course not found' });
  return res.json(result);
});

router.post('/readiness/:courseId/ai-evaluate', authenticate, async (req: Request, res: Response) => {
  const result = await evaluateSubmissionWithAi({
    userId: req.user!.id,
    courseId: req.params.courseId,
    lessonTitle: req.body?.lessonTitle,
    assignmentPrompt: req.body?.assignmentPrompt,
    submissionNote: req.body?.submissionNote,
    hasFile: req.body?.hasFile,
  });
  return res.json(result);
});

router.post('/readiness/:courseId/attendance-ping', authenticate, async (req: Request, res: Response) => {
  const result = await recordAttendanceCheckpoint(
    req.user!.id,
    req.params.courseId,
    Boolean(req.body?.checkpointPassed)
  );
  return res.json(result);
});

router.post('/readiness/:courseId/lecturer-grade', authenticate, async (req: Request, res: Response) => {
  const { studentId, lecturerScore, lecturerNote, lecturerName } = req.body as {
    studentId?: string;
    lecturerScore?: number;
    lecturerNote?: string;
    lecturerName?: string;
  };
  if (!studentId || typeof lecturerScore !== 'number') {
    return res.status(400).json({ message: 'studentId and lecturerScore are required' });
  }
  const result = await recordLecturerEvaluation({
    studentId,
    courseId: req.params.courseId,
    lecturerScore,
    lecturerNote,
    lecturerName: lecturerName ?? req.user?.email ?? 'CDC Lecturer',
  });
  return res.json(result);
});

router.get('/passport/me', authenticate, async (req: Request, res: Response) => {
  const payload = await getStudentDigitalPassport(req.user!.id);
  if (!payload) return res.status(404).json({ message: 'Student not found' });
  return res.json(payload);
});

router.get('/passport/public/:code', async (req: Request, res: Response) => {
  const payload = await getPublicDigitalPassportByCode(req.params.code);
  if (!payload) return res.status(404).json({ message: 'Digital Passport not found' });
  return res.json(payload);
});

router.get('/workspace-access', authenticate, async (req: Request, res: Response) => {
  const access = await resolveStudentWorkspaceAccess(req.user!.id);
  return res.json(access);
});

export default router;