/**
 * Express router mounted at `/api/course-mentor/learn` (see server.ts) — the
 * student side of the AI Course Mentor (stage 2). Logic lives in
 * services/courseMentorAgent/ (enrollmentService, lessonRunner, taskService).
 * Endpoints:
 *   POST /join                                   { code }
 *   GET  /courses
 *   GET  /courses/:courseId
 *   POST /courses/:courseId/lessons/:lessonId/start   { locale }
 *   GET  /sessions/:sessionId
 *   POST /sessions/:sessionId/messages           { text }
 *   POST /sessions/:sessionId/tasks              { homework?, difficulty? }
 *   POST /sessions/:sessionId/finish
 *   POST /tasks/:taskId/submit                   multipart: answer?, file?
 * Students don't buy anything: access follows the teacher's subscription
 * (checked per request in enrollmentService.assertCourseServing).
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  CourseMentorError,
  joinCourseByCode,
  listMyCourses,
  getMyCourse,
  startLessonSession,
  getLessonSession,
  sendStudentMessage,
  finishLessonSession,
  generateTasks,
  submitTask,
} from '../services/courseMentorAgent';

const router = Router();
router.use(authenticate, requireApproved);

// Short-window guard on top of the daily caps in usageLimits.ts.
const chatRateLimit = rateLimit({ windowMs: 60 * 1000, max: 12, message: 'Too many messages. Please slow down a little.' });
const joinRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, message: 'Too many attempts. Please wait a few minutes.' });

const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ok = /^(image\/(png|jpe?g|webp)|application\/pdf|application\/zip|text\/.+)$/.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Allowed files: images, PDF, ZIP or text.'));
  },
});

const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof CourseMentorError) return res.status(err.status).json({ code: err.code, message: err.message });
      if (err && typeof err === 'object' && 'issues' in err) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input.' });
      console.error('[courseMentorLearn route]', err);
      return res.status(500).json({ message: 'The mentor is temporarily unavailable. Please try again.' });
    }
  };

const localeOf = (req: Request, bodyLocale?: unknown) =>
  typeof bodyLocale === 'string' ? bodyLocale : (req.headers['accept-language'] ?? 'ka').toString().slice(0, 2);

router.post('/join', joinRateLimit, handle(async (req, res) => {
  const { code } = z.object({ code: z.string().trim().min(4).max(20) }).parse(req.body);
  res.json(await joinCourseByCode(req.user!.id, code));
}));

router.get('/courses', handle(async (req, res) => {
  res.json({ courses: await listMyCourses(req.user!.id) });
}));

router.get('/courses/:courseId', handle(async (req, res) => {
  res.json({ course: await getMyCourse(req.user!.id, req.params.courseId) });
}));

router.post('/courses/:courseId/lessons/:lessonId/start', chatRateLimit, handle(async (req, res) => {
  const session = await startLessonSession(req.user!.id, req.params.courseId, req.params.lessonId, localeOf(req, req.body?.locale));
  res.json({ session });
}));

router.get('/sessions/:sessionId', handle(async (req, res) => {
  res.json({ session: await getLessonSession(req.user!.id, req.params.sessionId) });
}));

router.post('/sessions/:sessionId/messages', chatRateLimit, handle(async (req, res) => {
  const { text } = z.object({ text: z.string().min(1).max(6000) }).parse(req.body);
  res.json(await sendStudentMessage(req.user!.id, req.params.sessionId, text));
}));

router.post('/sessions/:sessionId/tasks', chatRateLimit, handle(async (req, res) => {
  const opts = z.object({ homework: z.boolean().default(false), difficulty: z.enum(['easy', 'medium', 'hard']).optional() }).parse(req.body ?? {});
  res.json({ tasks: await generateTasks(req.user!.id, req.params.sessionId, opts) });
}));

router.post('/sessions/:sessionId/finish', handle(async (req, res) => {
  res.json({ session: await finishLessonSession(req.user!.id, req.params.sessionId) });
}));

router.post('/tasks/:taskId/submit', chatRateLimit, handle(async (req, res) => {
  await new Promise<void>((resolve, reject) => submissionUpload.single('file')(req, res, (err?: unknown) => (err ? reject(err) : resolve()))).catch((err) => {
    throw new CourseMentorError(400, err instanceof Error ? err.message : 'Upload failed.', 'UPLOAD_ERROR');
  });
  const answer = typeof req.body?.answer === 'string' ? req.body.answer : undefined;
  res.json({ task: await submitTask(req.user!.id, req.params.taskId, { answer, file: req.file ?? undefined }) });
}));

export default router;
