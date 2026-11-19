/**
 * Course Mentor Agent — students joining a course and seeing their progress.
 * Exports: joinCourseByCode, listMyCourses, getMyCourse, assertEnrolled, assertCourseServing.
 *
 * A student joins with the teacher's class code. Access is re-checked on
 * every call: the course must be ACTIVE (plan approved) and the teacher must
 * still have access to the tool (admin / grant / paid seats), so a lapsed
 * subscription stops the AI spend immediately.
 */
import { prisma } from '../../lib/prisma';
import { hasDigitalToolAccess } from '../marketplace/digitalToolAccessService';
import { isoDate } from './calendar';
import { CourseMentorError } from './types';

export async function assertCourseServing(courseId: string) {
  const course = await prisma.mentorCourse.findUnique({
    where: { id: courseId },
    select: { id: true, status: true, teacherId: true, teacher: { select: { email: true } } },
  });
  if (!course || course.status !== 'ACTIVE') throw new CourseMentorError(404, 'This course is not available.', 'COURSE_NOT_ACTIVE');
  if (!(await hasDigitalToolAccess(course.teacherId, course.teacher.email, 'course-mentor'))) {
    throw new CourseMentorError(403, 'The course subscription is not active. Please tell your teacher.', 'TEACHER_NO_ACCESS');
  }
  return course;
}

export async function joinCourseByCode(studentId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const course = await prisma.mentorCourse.findUnique({ where: { joinCode: code }, select: { id: true, title: true } });
  if (!course) throw new CourseMentorError(404, 'No course with this code.', 'BAD_CODE');
  await assertCourseServing(course.id);
  const enrollment = await prisma.mentorEnrollment.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId } },
    create: { courseId: course.id, studentId },
    update: { active: true },
  });
  return { courseId: course.id, title: course.title, enrollmentId: enrollment.id };
}

export async function assertEnrolled(studentId: string, courseId: string) {
  const enrollment = await prisma.mentorEnrollment.findUnique({ where: { courseId_studentId: { courseId, studentId } } });
  if (!enrollment || !enrollment.active) throw new CourseMentorError(404, 'You are not enrolled in this course.', 'NOT_ENROLLED');
  return enrollment;
}

export async function listMyCourses(studentId: string) {
  const rows = await prisma.mentorEnrollment.findMany({
    where: { studentId, active: true, course: { status: 'ACTIVE' } },
    include: { course: { select: { id: true, title: true, startDate: true, endDate: true, _count: { select: { lessons: true } } } } },
    orderBy: { joinedAt: 'desc' },
  });
  const done = await prisma.mentorLessonSession.groupBy({
    by: ['enrollmentId'],
    where: { enrollmentId: { in: rows.map((r) => r.id) }, status: 'COMPLETED' },
    _count: { _all: true },
  });
  const doneMap = new Map(done.map((d) => [d.enrollmentId, d._count._all]));
  return rows.map((r) => ({
    courseId: r.course.id,
    title: r.course.title,
    startDate: isoDate(r.course.startDate),
    endDate: isoDate(r.course.endDate),
    lessonCount: r.course._count.lessons,
    completedLessons: doneMap.get(r.id) ?? 0,
  }));
}

// Course overview for the student: every lesson with its date and the
// student's status/score, plus which lesson is "today" (first lesson dated
// today or earlier that isn't completed — so missed days are caught up).
export async function getMyCourse(studentId: string, courseId: string) {
  const enrollment = await assertEnrolled(studentId, courseId);
  await assertCourseServing(courseId);
  const course = await prisma.mentorCourse.findUniqueOrThrow({
    where: { id: courseId },
    select: {
      id: true, title: true, minutesPerLesson: true,
      modules: { orderBy: { position: 'asc' }, select: { id: true, position: true, title: true } },
      lessons: { orderBy: { position: 'asc' }, select: { id: true, moduleId: true, position: true, date: true, kind: true, title: true, objectives: true } },
    },
  });
  const sessions = await prisma.mentorLessonSession.findMany({
    where: { enrollmentId: enrollment.id },
    select: { lessonId: true, status: true, score: true },
  });
  const byLesson = new Map(sessions.map((s) => [s.lessonId, s]));
  const today = isoDate(new Date());
  const lessons = course.lessons.map((l) => {
    const s = byLesson.get(l.id);
    return { ...l, date: isoDate(l.date), status: s?.status ?? 'NOT_STARTED', score: s?.score ?? null };
  });
  const current =
    lessons.find((l) => l.date <= today && l.status !== 'COMPLETED') ??
    lessons.find((l) => l.status !== 'COMPLETED') ??
    null;
  const scored = lessons.filter((l) => l.score !== null);
  return {
    id: course.id,
    title: course.title,
    minutesPerLesson: course.minutesPerLesson,
    modules: course.modules,
    lessons,
    currentLessonId: current?.id ?? null,
    progress: {
      completed: lessons.filter((l) => l.status === 'COMPLETED').length,
      total: lessons.length,
      dueByToday: lessons.filter((l) => l.date <= today).length,
      averageScore: scored.length ? Math.round(scored.reduce((a, l) => a + (l.score ?? 0), 0) / scored.length) : null,
    },
  };
}
