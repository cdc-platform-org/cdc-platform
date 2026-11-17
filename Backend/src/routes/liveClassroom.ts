/**
 * @fileoverview HTTP endpoints for the Live Interactive Classroom.
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requireNotBannedOrDeleted } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import {
  upsertStudentScreenFrame,
  removeStudentScreenFrame,
  getActiveClassroomScreens,
  finalizeRecordingAndNotifyStudents,
  getClassroomRecordings,
  uploadClassroomRecording,
} from '../services/liveClassroomService';

const router = Router();

async function classroomAccess(req: Request, res: Response, next: NextFunction) {
  const trainingId = req.params.trainingId;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true, role: true } });
  const trainer = await prisma.liveTrainingTrainerAssignment.findFirst({
    where: { liveTrainingId: trainingId, trainerProfile: { userId: req.user!.id, active: true } },
  });
  const canManage = !!user?.adminRole || user?.role === 'SuperAdmin' || !!trainer;
  const enrollment = canManage ? true : await prisma.liveTrainingEnrollment.findFirst({
    where: { liveTrainingId: trainingId, userId: req.user!.id, status: { in: ['ACTIVE', 'COMPLETED'] } },
  });
  if (!enrollment) return res.status(403).json({ message: 'Classroom enrollment is required.' });
  if ((req.path.endsWith('/recording-complete') || req.path.endsWith('/recordings/upload')) && !canManage) {
    return res.status(403).json({ message: 'Only the assigned trainer or an administrator may publish recordings.' });
  }
  res.locals.canManageClassroom = canManage;
  next();
}

router.use('/:trainingId', authenticate, requireNotBannedOrDeleted, classroomAccess);

const recordingUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
router.post('/:trainingId/recordings/upload', (req: Request, res: Response, next: NextFunction) => {
  recordingUpload.single('file')(req, res, (error) => {
    if (error) return res.status(400).json({ message: 'Recording upload rejected (maximum 100 MB).' });
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file || !['video/webm', 'video/mp4'].includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'A WebM or MP4 recording is required.' });
  }
  const recordingUrl = await uploadClassroomRecording(req.params.trainingId, req.file.buffer, req.file.mimetype);
  const record = await finalizeRecordingAndNotifyStudents({ trainingId: req.params.trainingId, recordingUrl, recordedBy: req.user!.email });
  return res.status(201).json({ record });
});

router.post('/:trainingId/screen-frame', authenticate, async (req: Request, res: Response) => {
  const { imageDataUrl, studentName, activeTool } = req.body as {
    imageDataUrl?: string;
    studentName?: string;
    activeTool?: string;
  };
  if (!imageDataUrl) return res.status(400).json({ message: 'imageDataUrl is required' });

  const frame = upsertStudentScreenFrame(req.params.trainingId, {
    userId: req.user!.id,
    studentName: studentName || req.user!.email.split('@')[0],
    studentEmail: req.user!.email,
    imageDataUrl,
    activeTool,
  });
  return res.json({ ok: true, updatedAt: frame.updatedAt });
});

router.delete('/:trainingId/screen-frame', authenticate, async (req: Request, res: Response) => {
  removeStudentScreenFrame(req.params.trainingId, req.user!.id);
  return res.json({ ok: true });
});

router.get('/:trainingId/screens', authenticate, async (req: Request, res: Response) => {
  const screens = getActiveClassroomScreens(req.params.trainingId).filter((frame) => res.locals.canManageClassroom || frame.userId === req.user!.id);
  const recordings = await getClassroomRecordings(req.params.trainingId);
  return res.json({ screens, recordings, canManage: res.locals.canManageClassroom });
});

router.post('/:trainingId/recording-complete', authenticate, async (req: Request, res: Response) => {
  const { recordingUrl } = req.body as { recordingUrl?: string };
  const validated = z.string().url().refine((url) => url.startsWith('https://')).safeParse(recordingUrl);
  if (!validated.success) return res.status(400).json({ message: 'A persistent HTTPS recording URL is required' });

  const record = await finalizeRecordingAndNotifyStudents({
    trainingId: req.params.trainingId,
    recordingUrl: validated.data,
    recordedBy: req.user!.email,
  });
  return res.json({ record });
});

export default router;
