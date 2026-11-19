/**
 * Express router mounted at `/api/course-mentor` (see server.ts) — AI Course
 * Mentor Agent, teacher side (stage 1). Logic lives in services/courseMentorAgent/.
 * Endpoints:
 *   GET    /courses
 *   POST   /courses
 *   GET    /courses/:courseId
 *   PUT    /courses/:courseId
 *   DELETE /courses/:courseId
 *   POST   /courses/:courseId/documents          (multipart "file")
 *   DELETE /courses/:courseId/documents/:documentId
 *   POST   /courses/:courseId/plan               (start / re-run the planner)
 *   POST   /courses/:courseId/approve
 *   PATCH  /courses/:courseId/lessons/:lessonId
 * Access: its own Digital Tool key 'course-mentor' (admin, AccessGrant, later paid seats).
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { authenticate, requireApproved } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { requireDigitalToolAccess } from '../services/marketplace/digitalToolAccessService';
import { isAiAgentConfigured } from '../services/ai/aiAgentService';
import { courseInputSchema, lessonEditSchema } from '../schemas/courseMentorSchemas';
import {
  CourseMentorError,
  createCourse,
  listTeacherCourses,
  getTeacherCourse,
  updateCourse,
  deleteCourse,
  assertTeacherOwnsCourse,
  deleteDocument,
  updateLesson,
  approvePlan,
  ingestDocument,
  startCoursePlanning,
  SUPPORTED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from '../services/courseMentorAgent';

const router = Router();
router.use(authenticate, requireApproved, requireDigitalToolAccess('course-mentor'));

const MAX_DOCUMENTS_PER_COURSE = 20;
const planRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 6, message: 'Too many planning runs. Please wait a while.' });
const uploadRateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, message: 'Too many uploads. Please wait a few minutes.' });

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Browsers send non-ASCII filenames as latin1-decoded UTF-8 bytes.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (SUPPORTED_UPLOAD_EXTENSIONS.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, DOCX, Markdown or TXT files are allowed.'));
  },
});

// Wraps async handlers: CourseMentorError -> its status + safe message,
// zod errors -> 400, everything else -> 500 without internals.
const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof CourseMentorError) return res.status(err.status).json({ code: err.code, message: err.message });
      if (err && typeof err === 'object' && 'issues' in err) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid input.', issues: (err as { issues: unknown }).issues });
      }
      console.error('[courseMentor route]', err);
      return res.status(500).json({ message: 'Something went wrong. Please try again.' });
    }
  };

router.get('/courses', handle(async (req, res) => {
  res.json({ courses: await listTeacherCourses(req.user!.id) });
}));

router.post('/courses', handle(async (req, res) => {
  const input = courseInputSchema.parse(req.body);
  const course = await createCourse(req.user!.id, input);
  res.status(201).json({ course: { id: course.id } });
}));

router.get('/courses/:courseId', handle(async (req, res) => {
  res.json({ course: await getTeacherCourse(req.user!.id, req.params.courseId) });
}));

router.put('/courses/:courseId', handle(async (req, res) => {
  const input = courseInputSchema.parse(req.body);
  await updateCourse(req.user!.id, req.params.courseId, input);
  res.json({ ok: true });
}));

router.delete('/courses/:courseId', handle(async (req, res) => {
  await deleteCourse(req.user!.id, req.params.courseId);
  res.json({ ok: true });
}));

router.post(
  '/courses/:courseId/documents',
  uploadRateLimit,
  // Ownership is checked BEFORE multer reads a 40 MB body into memory.
  handle(async (req, res) => {
    const course = await assertTeacherOwnsCourse(req.user!.id, req.params.courseId);
    if (course.status === 'PLANNING') throw new CourseMentorError(409, 'Wait until the plan is generated.', 'ALREADY_PLANNING');
    await new Promise<void>((resolve, reject) =>
      documentUpload.single('file')(req, res, (err?: unknown) => (err ? reject(err) : resolve()))
    ).catch((err) => {
      throw new CourseMentorError(400, err instanceof Error ? err.message : 'Upload failed.', 'UPLOAD_ERROR');
    });
    if (!req.file) throw new CourseMentorError(400, 'Choose a file to upload.', 'NO_FILE');
    const count = await prisma.mentorSourceDocument.count({ where: { courseId: course.id } });
    if (count >= MAX_DOCUMENTS_PER_COURSE) throw new CourseMentorError(400, `A course can have at most ${MAX_DOCUMENTS_PER_COURSE} documents.`, 'TOO_MANY_DOCUMENTS');
    const doc = await ingestDocument(course.id, req.file);
    res.status(202).json({ document: doc });
  })
);

router.delete('/courses/:courseId/documents/:documentId', handle(async (req, res) => {
  await deleteDocument(req.user!.id, req.params.courseId, req.params.documentId);
  res.json({ ok: true });
}));

router.post('/courses/:courseId/plan', planRateLimit, handle(async (req, res) => {
  if (!isAiAgentConfigured()) throw new CourseMentorError(503, 'AI is not configured on this server.', 'AI_NOT_CONFIGURED');
  await assertTeacherOwnsCourse(req.user!.id, req.params.courseId);
  await startCoursePlanning(req.params.courseId);
  res.status(202).json({ ok: true });
}));

router.post('/courses/:courseId/approve', handle(async (req, res) => {
  await approvePlan(req.user!.id, req.params.courseId);
  res.json({ ok: true });
}));

router.patch('/courses/:courseId/lessons/:lessonId', handle(async (req, res) => {
  const edit = lessonEditSchema.parse(req.body);
  res.json({ lesson: await updateLesson(req.user!.id, req.params.courseId, req.params.lessonId, edit) });
}));

export default router;
