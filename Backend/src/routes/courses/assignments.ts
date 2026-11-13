/**
 * Homework assignments: student submissions per lesson and admin grading.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole, requireApproved } from '../../middleware/auth';
import { BunnyStorageUploadError } from '../../services/bunnyStorage';
import {
  uploadAssignmentSubmissionFile,
  resolveAssignmentSubmissionDeliveryUrl,
} from '../../services/assignmentSubmissionDelivery';
import { submitAssignmentSchema, gradeAssignmentSchema } from '../../schemas/courseSchemas';

const router = Router();

// ============================================================
// HOMEWORK ASSIGNMENTS — one submission per student per lesson (resubmit
// overwrites, see the schema's unique constraint), reviewed by admins.
// ============================================================

// Student: submit/resubmit for a lesson they're enrolled in.
const assignmentFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — homework files, not lesson videos
});

// Student: upload a homework file, get back a URL to pass as fileUrl in the
// actual POST /submissions call below (kept separate so a slow upload
// doesn't block/duplicate the submission record itself).
router.post(
  '/lessons/:lessonId/submissions/upload',
  authenticate,
  requireApproved,
  (req: Request, res: Response, next: NextFunction) => {
    assignmentFileUpload.single('file')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File is too large (50MB max).' });
      }
      return res.status(400).json({ message: err.message || 'Upload rejected.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No file was selected.' });
    try {
      // Private Azure Blob storage, not the public Bunny CDN this used to
      // use — a student's homework is private to them (and to an
      // admin/grader), never a public link. See
      // assignmentSubmissionDelivery.ts for why.
      const url = await uploadAssignmentSubmissionFile(req.user!.id, req.params.lessonId, req.file.buffer, req.file.mimetype, req.file.originalname);
      res.status(201).json({ data: { url } });
    } catch (err) {
      const message = err instanceof BunnyStorageUploadError ? err.message : 'File upload failed. Please try again.';
      res.status(500).json({ message });
    }
  }
);

router.post('/lessons/:lessonId/submissions', authenticate, requireApproved, async (req: Request, res: Response) => {
  const result = submitAssignmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId }, include: { section: true } });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: lesson.section.courseId } },
  });
  if (!enrollment) return res.status(403).json({ message: 'You are not enrolled in this course.' });

  const submission = await prisma.assignmentSubmission.upsert({
    where: { lessonId_userId: { lessonId: lesson.id, userId: req.user!.id } },
    // A resubmission clears any prior grading — it's a new attempt, not an
    // edit of the graded one.
    update: { ...result.data, status: 'PENDING', feedback: null },
    create: { ...result.data, lessonId: lesson.id, userId: req.user!.id },
  });
  res.status(201).json({ data: submission });
});

// Student: their own submission for a lesson (to show status/feedback on
// the player's Assignment tab).
router.get('/lessons/:lessonId/submissions/mine', authenticate, async (req: Request, res: Response) => {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { lessonId_userId: { lessonId: req.params.lessonId, userId: req.user!.id } },
  });
  res.json({ data: submission });
});

// Resolves the caller's OWN submission file into something actually
// openable — a legacy Bunny row already is one; a new Azure-private
// cdcblob:// marker is not itself a URL, so the frontend must go through
// this rather than opening fileUrl directly. See GET /admin/submissions/:id/document
// for the grading-side counterpart.
router.get('/lessons/:lessonId/submissions/mine/document', authenticate, async (req: Request, res: Response) => {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { lessonId_userId: { lessonId: req.params.lessonId, userId: req.user!.id } },
    select: { fileUrl: true },
  });
  if (!submission?.fileUrl) return res.status(404).json({ message: 'No submission file on file.' });
  const url = await resolveAssignmentSubmissionDeliveryUrl(submission.fileUrl);
  res.json({ data: { url } });
});

// Admin: every submission across every course, most recent first — the
// review queue backing /admin/assignments.
router.get('/admin/submissions', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;
  const submissions = await prisma.assignmentSubmission.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      lesson: { select: { id: true, title: true, section: { select: { title: true, course: { select: { id: true, title: true } } } } } },
    },
  });
  res.json({ data: submissions });
});

// Admin-authorized document resolve — see .../submissions/mine/document
// for the student-side counterpart; never send fileUrl's raw value to the
// browser as if it were an openable link.
router.get('/admin/submissions/:id/document', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const submission = await prisma.assignmentSubmission.findUnique({ where: { id: req.params.id }, select: { fileUrl: true } });
  if (!submission?.fileUrl) return res.status(404).json({ message: 'No submission file on file.' });
  const url = await resolveAssignmentSubmissionDeliveryUrl(submission.fileUrl);
  res.json({ data: { url } });
});

router.post('/admin/submissions/:id/grade', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = gradeAssignmentSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  try {
    const updated = await prisma.assignmentSubmission.update({
      where: { id: req.params.id },
      data: result.data,
    });
    res.json({ data: updated });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Submission not found.' });
    throw err;
  }
});

export default router;
