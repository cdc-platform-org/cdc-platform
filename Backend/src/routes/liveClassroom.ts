/**
 * @fileoverview HTTP endpoints for the Live Interactive Classroom.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  upsertStudentScreenFrame,
  removeStudentScreenFrame,
  getActiveClassroomScreens,
  finalizeRecordingAndNotifyStudents,
  getClassroomRecordings,
} from '../services/liveClassroomService';

const router = Router();

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
  const screens = getActiveClassroomScreens(req.params.trainingId);
  const recordings = getClassroomRecordings(req.params.trainingId);
  return res.json({ screens, recordings });
});

router.post('/:trainingId/recording-complete', authenticate, async (req: Request, res: Response) => {
  const { recordingUrl } = req.body as { recordingUrl?: string };
  if (!recordingUrl) return res.status(400).json({ message: 'recordingUrl is required' });

  const record = await finalizeRecordingAndNotifyStudents({
    trainingId: req.params.trainingId,
    recordingUrl,
    recordedBy: req.user!.email,
  });
  return res.json({ record });
});

export default router;