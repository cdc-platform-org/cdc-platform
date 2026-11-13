/**
 * The /learn player: curriculum (sections + lessons) and per-lesson progress.
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireNotBannedOrDeleted } from '../../middleware/auth';
import { lessonProgressUpdateSchema } from '../../schemas/courseSchemas';
import { requireCourseAccess, lessonWithPlayback } from './shared';

const router = Router();

// Curriculum for the /learn player — sections + lessons in order, with the
// current user's per-lesson completion merged in.
router.get('/:id/curriculum', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const sections = await prisma.courseSection.findMany({
    where: { courseId: req.params.id },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: { progress: { where: { userId: req.user!.id } } },
      },
    },
  });

  res.json({
    data: sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        durationSeconds: lesson.durationSeconds,
        order: lesson.order,
        resources: lesson.resources,
        assignmentPrompt: lesson.assignmentPrompt,
        completed: lesson.progress[0]?.completed ?? false,
        conspectusStatus: lesson.conspectusStatus,
        conspectusKa: lesson.conspectusKa,
        conspectusEn: lesson.conspectusEn,
        conspectusRu: lesson.conspectusRu,
        ...lessonWithPlayback(lesson),
      })),
    })),
  });
});

router.get('/:id/progress', authenticate, requireCourseAccess, async (req: Request, res: Response) => {
  const totalLessons = await prisma.lesson.count({ where: { section: { courseId: req.params.id } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { completed: true, userId: req.user!.id, lesson: { section: { courseId: req.params.id } } },
  });
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  res.json({ data: { totalLessons, completedLessons, percent } });
});

router.post('/lessons/:lessonId/progress', authenticate, requireNotBannedOrDeleted, async (req: Request, res: Response) => {
  const result = lessonProgressUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ errors: result.error.errors });

  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.lessonId },
    include: { section: true },
  });
  if (!lesson) return res.status(404).json({ message: 'Lesson not found.' });

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: lesson.section.courseId } },
  });
  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { adminRole: true } });
  if (!enrollment && !admin?.adminRole) {
    return res.status(403).json({ message: 'You are not enrolled in this course.' });
  }

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    update: { completed: result.data.completed, completedAt: result.data.completed ? new Date() : null },
    create: {
      userId: req.user!.id,
      lessonId: lesson.id,
      completed: result.data.completed,
      completedAt: result.data.completed ? new Date() : null,
    },
  });
  res.json({ data: { lessonId: progress.lessonId, completed: progress.completed } });
});

export default router;
