/**
 * Course Mentor Agent — teacher-side course management (no AI here).
 * Exports: generateJoinCode, createCourse, listTeacherCourses, getTeacherCourse, updateCourse,
 * deleteCourse, assertTeacherOwnsCourse, deleteDocument, updateLesson, approvePlan,
 * CourseInput, LessonEdit.
 *
 * Every function takes the teacher's user id and checks ownership itself, so
 * a route can never leak one teacher's documents or plan to another.
 */
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { isoDate, listClassDays, parseIsoDate } from './calendar';
import { clearRetrievalCache } from './retrieval';
import { CourseMentorError } from './types';

// A planner that has not reported progress for this long was killed by a
// restart/deploy — surface it as failed so the teacher can retry.
const STALE_PLANNING_MS = 30 * 60_000;
const STALE_PROCESSING_MS = 30 * 60_000;

// No 0/O/1/I so codes can be read aloud and typed from a projector.
const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateJoinCode(length = 7): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) code += JOIN_ALPHABET[bytes[i] % JOIN_ALPHABET.length];
  return code;
}

export interface CourseInput {
  title: string;
  audience: string;
  goals: string;
  instructions?: string | null;
  teachingLocale: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  minutesPerLesson: number;
  excludedDates: string[];
  taskTypes: string[];
}

function toCourseData(input: CourseInput) {
  const start = parseIsoDate(input.startDate);
  const end = parseIsoDate(input.endDate);
  if (end <= start) throw new CourseMentorError(400, 'The end date must be after the start date.', 'BAD_DATES');
  const weekdays = [...new Set(input.weekdays)].sort();
  if (listClassDays(start, end, weekdays, input.excludedDates).length === 0) {
    throw new CourseMentorError(400, 'The calendar has no class days.', 'NO_CLASS_DAYS');
  }
  return {
    title: input.title.trim(),
    audience: input.audience.trim(),
    goals: input.goals.trim(),
    instructions: input.instructions?.trim() || null,
    teachingLocale: input.teachingLocale,
    startDate: start,
    endDate: end,
    weekdays,
    minutesPerLesson: input.minutesPerLesson,
    excludedDates: [...new Set(input.excludedDates)].sort(),
    taskTypes: [...new Set(input.taskTypes)],
  };
}

export async function createCourse(teacherId: string, input: CourseInput) {
  const data = toCourseData(input);
  // Unique-violation retry: 32^7 codes make a clash rare, never impossible.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.mentorCourse.create({ data: { ...data, teacherId, joinCode: generateJoinCode() } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
  }
  throw new CourseMentorError(500, 'Could not create a join code. Please try again.');
}

export async function assertTeacherOwnsCourse(teacherId: string, courseId: string) {
  const course = await prisma.mentorCourse.findFirst({ where: { id: courseId, teacherId } });
  if (!course) throw new CourseMentorError(404, 'Course not found.', 'NOT_FOUND');
  return course;
}

// Marks work that died with a server restart as failed (see constants).
async function expireStaleJobs(courseId: string) {
  const now = Date.now();
  await prisma.mentorCourse.updateMany({
    where: { id: courseId, status: 'PLANNING', updatedAt: { lt: new Date(now - STALE_PLANNING_MS) } },
    data: { status: 'PLAN_FAILED', planError: 'Planning was interrupted (server restart). Please run it again.', planProgress: Prisma.DbNull },
  });
  await prisma.mentorSourceDocument.updateMany({
    where: { courseId, status: 'PROCESSING', createdAt: { lt: new Date(now - STALE_PROCESSING_MS) } },
    data: { status: 'FAILED', error: 'Processing was interrupted (server restart). Please upload the file again.' },
  });
}

export async function listTeacherCourses(teacherId: string) {
  const courses = await prisma.mentorCourse.findMany({
    where: { teacherId, status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, status: true, startDate: true, endDate: true, joinCode: true, createdAt: true,
      _count: { select: { documents: true, lessons: true } },
    },
  });
  return courses.map((c) => ({ ...c, startDate: isoDate(c.startDate), endDate: isoDate(c.endDate) }));
}

export async function getTeacherCourse(teacherId: string, courseId: string) {
  await assertTeacherOwnsCourse(teacherId, courseId);
  await expireStaleJobs(courseId);
  const course = await prisma.mentorCourse.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      documents: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, filename: true, sizeBytes: true, sourceUrl: true, note: true, status: true, error: true, charCount: true, chunkCount: true, createdAt: true },
      },
      modules: { orderBy: { position: 'asc' }, select: { id: true, position: true, title: true, summary: true, weight: true } },
      lessons: {
        orderBy: { position: 'asc' },
        select: { id: true, moduleId: true, position: true, date: true, kind: true, title: true, objectives: true, topics: true, plan: true, teacherEdited: true },
      },
    },
  });
  const classDays = listClassDays(course.startDate, course.endDate, course.weekdays, course.excludedDates).length;
  return {
    ...course,
    startDate: isoDate(course.startDate),
    endDate: isoDate(course.endDate),
    classDays,
    lessons: course.lessons.map((l) => ({ ...l, date: isoDate(l.date) })),
  };
}

export async function updateCourse(teacherId: string, courseId: string, input: CourseInput) {
  const course = await assertTeacherOwnsCourse(teacherId, courseId);
  if (course.status === 'PLANNING') throw new CourseMentorError(409, 'Wait until the plan is generated.', 'ALREADY_PLANNING');
  const data = toCourseData(input);
  const calendarChanged =
    isoDate(course.startDate) !== isoDate(data.startDate) ||
    isoDate(course.endDate) !== isoDate(data.endDate) ||
    course.weekdays.join() !== data.weekdays.join() ||
    course.excludedDates.join() !== data.excludedDates.join();
  // A new calendar invalidates lesson dates: the teacher re-runs the planner.
  return prisma.mentorCourse.update({
    where: { id: courseId },
    data: { ...data, ...(calendarChanged && course.status !== 'DRAFT' ? { status: 'DRAFT' as const } : {}) },
  });
}

export async function deleteCourse(teacherId: string, courseId: string) {
  await assertTeacherOwnsCourse(teacherId, courseId);
  await prisma.mentorCourse.update({ where: { id: courseId }, data: { status: 'ARCHIVED' } });
  clearRetrievalCache(courseId);
}

export async function deleteDocument(teacherId: string, courseId: string, documentId: string) {
  const course = await assertTeacherOwnsCourse(teacherId, courseId);
  if (course.status === 'PLANNING') throw new CourseMentorError(409, 'Wait until the plan is generated.', 'ALREADY_PLANNING');
  const { count } = await prisma.mentorSourceDocument.deleteMany({ where: { id: documentId, courseId } });
  if (count === 0) throw new CourseMentorError(404, 'Document not found.', 'NOT_FOUND');
  clearRetrievalCache(courseId);
}

export interface LessonEdit {
  title?: string;
  objectives?: string[];
  topics?: string[];
  summary?: string;
  homework?: { description: string; deliverable: string };
}

export async function updateLesson(teacherId: string, courseId: string, lessonId: string, edit: LessonEdit) {
  await assertTeacherOwnsCourse(teacherId, courseId);
  const lesson = await prisma.mentorLesson.findFirst({ where: { id: lessonId, courseId } });
  if (!lesson) throw new CourseMentorError(404, 'Lesson not found.', 'NOT_FOUND');
  const plan = { ...(lesson.plan as Record<string, unknown>) };
  if (edit.summary !== undefined) plan.summary = edit.summary;
  if (edit.homework !== undefined) plan.homework = edit.homework;
  const updated = await prisma.mentorLesson.update({
    where: { id: lessonId },
    data: {
      ...(edit.title !== undefined ? { title: edit.title } : {}),
      ...(edit.objectives !== undefined ? { objectives: edit.objectives } : {}),
      ...(edit.topics !== undefined ? { topics: edit.topics } : {}),
      plan: plan as Prisma.InputJsonValue,
      teacherEdited: true,
    },
  });
  return { ...updated, date: isoDate(updated.date) };
}

export async function approvePlan(teacherId: string, courseId: string) {
  const course = await assertTeacherOwnsCourse(teacherId, courseId);
  if (course.status !== 'PLAN_READY') throw new CourseMentorError(409, 'There is no generated plan to approve.', 'NO_PLAN');
  return prisma.mentorCourse.update({ where: { id: courseId }, data: { status: 'ACTIVE' } });
}
