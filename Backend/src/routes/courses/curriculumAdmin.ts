/**
 * Admin authoring of sections and lessons, including lesson video upload
 * (Bunny Stream) and subtitle generation.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../../lib/prisma';
import { authenticate, requireAdminRole } from '../../middleware/auth';
import {
  sectionCreateSchema,
  sectionUpdateSchema,
  lessonCreateSchema,
  lessonUpdateSchema,
} from '../../schemas/courseSchemas';
import {
  createBunnyVideo,
  uploadBunnyVideoBinary,
  deleteBunnyVideo,
  isBunnyConfigured,
} from '../../services/bunnyStreamService';
import {
  processLessonSubtitles,
  isSubtitlePipelineConfigured,
  regenerateLessonSubtitles,
} from '../../services/subtitleService';
import { lessonWithPlayback } from './shared';

const router = Router();

// ---- Admin: sections & lessons ----

router.post('/:courseId/sections', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = sectionCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const section = await prisma.courseSection.create({ data: { ...result.data, courseId: course.id } });
  res.status(201).json({ data: section });
});

router.put('/sections/:sectionId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = sectionUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  try {
    const section = await prisma.courseSection.update({ where: { id: req.params.sectionId }, data: result.data });
    res.json({ data: section });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Section not found.' });
    throw err;
  }
});

router.delete('/sections/:sectionId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    await prisma.courseSection.delete({ where: { id: req.params.sectionId } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Section not found.' });
    throw err;
  }
});

router.post('/sections/:sectionId/lessons', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = lessonCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const section = await prisma.courseSection.findUnique({ where: { id: req.params.sectionId } });
  if (!section) return res.status(404).json({ message: 'Section not found.' });
  const lesson = await prisma.lesson.create({ data: { ...result.data, sectionId: section.id } });
  res.status(201).json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
});

// Pulls a bare Bunny Stream video GUID out of a pasted embed/play URL
// (e.g. "https://iframe.mediadelivery.net/embed/710897/<guid>") — passes
// through unchanged if it's already just the ID.
function extractBunnyVideoId(input: string): string {
  const match = input.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  return match ? match[1] : input.trim();
}

router.put('/lessons/:lessonId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const result = lessonUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });
  const { bunnyVideoId, ...rest } = result.data;
  try {
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data: { ...rest, ...(bunnyVideoId !== undefined ? { bunnyVideoId: bunnyVideoId ? extractBunnyVideoId(bunnyVideoId) : null } : {}) },
    });
    res.json({ data: { ...lesson, ...lessonWithPlayback(lesson) } });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Lesson not found.' });
    throw err;
  }
});

router.delete('/lessons/:lessonId', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
  if (lesson.bunnyVideoId) {
    await deleteBunnyVideo(lesson.bunnyVideoId).catch(() => {});
  }
  await prisma.lesson.delete({ where: { id: lesson.id } });
  res.status(204).send();
});

// Admin: full curriculum (bypasses enrollment — admin-team gate only), for
// the /admin/courses editor to list/manage sections+lessons.
router.get('/:courseId/curriculum/admin', authenticate, requireAdminRole('SUPER_ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  const sections = await prisma.courseSection.findMany({
    where: { courseId: req.params.courseId },
    orderBy: { order: 'asc' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  });
  res.json({
    data: sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => ({ ...lesson, ...lessonWithPlayback(lesson) })),
    })),
  });
});

// ---- Admin: direct-from-browser video upload for a lesson ----

const videoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files are allowed.'));
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB — course lessons run much longer than gig/forum attachments
});

router.post(
  '/lessons/:lessonId/video',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  (req: Request, res: Response, next: NextFunction) => {
    if (!isBunnyConfigured()) {
      return res.status(501).json({ message: 'Bunny Stream is not configured (BUNNY_STREAM_API_KEY / BUNNY_STREAM_LIBRARY_ID).' });
    }
    next();
  },
  (req: Request, res: Response, next: NextFunction) => {
    videoUpload.single('video')(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'The video exceeds the 2GB limit.' });
      }
      return res.status(400).json({ message: err.message || 'Only video files are allowed.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ message: 'No video file was provided.' });
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

    if (lesson.bunnyVideoId) {
      await deleteBunnyVideo(lesson.bunnyVideoId).catch(() => {});
    }

    try {
      const videoId = await createBunnyVideo(lesson.title);
      await uploadBunnyVideoBinary(videoId, req.file.buffer);
      const updated = await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          bunnyVideoId: videoId,
          subtitlesStatus: isSubtitlePipelineConfigured() ? 'PENDING' : null,
          subtitlesError: null,
          conspectusStatus: isSubtitlePipelineConfigured() ? 'PENDING' : null,
          conspectusError: null,
        },
      });
      res.status(201).json({ data: { ...updated, ...lessonWithPlayback(updated) } });
      // Fire-and-forget — never blocks/breaks the upload response above; see
      // subtitleService.ts's own top-of-file note on why there's no queue.
      if (isSubtitlePipelineConfigured()) {
        processLessonSubtitles(lesson.id, videoId, req.file.buffer).catch((err) => {
          console.error(`[courses] subtitle pipeline threw unexpectedly for lesson ${lesson.id}:`, err);
        });
      }
    } catch (err) {
      // Surface Bunny's actual error (invalid credentials, quota, network,
      // etc.) instead of a generic message — this is exactly the kind of
      // failure that's otherwise silent/unclear to whoever's uploading.
      const message = err instanceof Error ? `Video upload to Bunny Stream failed: ${err.message}` : 'Video upload to Bunny Stream failed. Please try again.';
      res.status(502).json({ message });
    }
  }
);

// Admin: re-run the ka/en/ru subtitle pipeline for a lesson whose video is
// already uploaded — for videos that predate this feature, or where a
// previous run partially failed (e.g. only "ka" succeeded). Re-fetches the
// video from Bunny's CDN since the original upload buffer was never kept on
// our side (see subtitleService.regenerateLessonSubtitles's own comment).
router.post(
  '/lessons/:lessonId/subtitles/regenerate',
  authenticate,
  requireAdminRole('SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res: Response) => {
    if (!isSubtitlePipelineConfigured()) {
      return res.status(501).json({ message: 'Subtitle pipeline is not configured (GEMINI_API_KEY missing, or ffmpeg unavailable).' });
    }
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.lessonId } });
    if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });
    if (!lesson.bunnyVideoId) return res.status(400).json({ message: 'This lesson has no video uploaded yet.' });

    const updated = await prisma.lesson.update({
      where: { id: lesson.id },
      data: { subtitlesStatus: 'PENDING', subtitlesError: null, conspectusStatus: 'PENDING', conspectusError: null },
    });
    res.status(202).json({ data: { ...updated, ...lessonWithPlayback(updated) } });

    // Fire-and-forget, same posture as the upload route above — regenerates
    // the conspectus too, since regenerateLessonSubtitles calls the same
    // processLessonSubtitles that now handles both.
    regenerateLessonSubtitles(lesson.id, lesson.bunnyVideoId).catch((err) => {
      console.error(`[courses] subtitle regeneration threw unexpectedly for lesson ${lesson.id}:`, err);
    });
  }
);

export default router;
