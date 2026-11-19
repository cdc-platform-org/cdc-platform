/**
 * Course Mentor Agent — running one lesson for one student.
 * Exports: loadLessonContext, startLessonSession, getLessonSession, sendStudentMessage,
 * finishLessonSession, SAFE_LOCALES.
 *
 * Flow: start (mentor opens with explanation + first check question) ->
 * chat turns (gpt-4o-mini, escalated to gpt-4o when the student is stuck,
 * see mentorModels.ts) -> tasks (taskService.ts) -> finish (gpt-4o writes
 * the evaluation the teacher's report is built from).
 */
import { prisma } from '../../lib/prisma';
import { AzureChatMessage } from '../ai/azureChatCompletionService';
import { assertCourseServing, assertEnrolled } from './enrollmentService';
import { chatWithMain, chatWithMini, jsonWithModel, shouldEscalate } from './mentorModels';
import { buildEvaluationPrompt, buildTutorSystemPrompt, LessonContext, OPENING_INSTRUCTION } from './prompts/tutorPrompts';
import { consumeUsage, tryConsumeUsage } from './usageLimits';
import { CourseMentorError, LessonBlueprint } from './types';
import { z } from 'zod';

export const SAFE_LOCALES = ['ka', 'en', 'de', 'es', 'fr', 'tr', 'uk', 'az', 'hy'];
const HISTORY_TURNS = 16;
const ESCALATED_HISTORY_TURNS = 8; // gpt-4o turns get a trimmed context (cost)
const SOURCE_CHARS = 1500;
const MAX_MESSAGE_CHARS = 6000;

type PlanBody = Omit<LessonBlueprint, 'kind' | 'title' | 'objectives' | 'topics'>;

export async function loadLessonContext(enrollmentId: string, lessonId: string, locale: string, sourceLimit = 4): Promise<LessonContext> {
  const lesson = await prisma.mentorLesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { course: { select: { title: true, audience: true, goals: true, instructions: true, taskTypes: true, _count: { select: { lessons: true } } } } },
  });
  const plan = lesson.plan as unknown as PlanBody;
  const chunks = lesson.sourceChunkIds.length
    ? await prisma.mentorSourceChunk.findMany({ where: { id: { in: lesson.sourceChunkIds.slice(0, sourceLimit) } }, select: { heading: true, content: true } })
    : [];
  // Personalisation: what this student struggled with in recent lessons.
  const recent = await prisma.mentorLessonSession.findMany({
    where: { enrollmentId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 3,
    select: { evaluation: true },
  });
  const studentStruggles = recent
    .flatMap((r) => ((r.evaluation as { struggles?: string[] } | null)?.struggles ?? []))
    .slice(0, 6);

  return {
    courseTitle: lesson.course.title,
    audience: lesson.course.audience,
    goals: lesson.course.goals,
    teacherInstructions: lesson.course.instructions,
    lessonNumber: lesson.position,
    lessonCount: lesson.course._count.lessons,
    kind: lesson.kind,
    title: lesson.title,
    summary: plan.summary,
    objectives: lesson.objectives,
    topics: lesson.topics,
    flow: plan.flow ?? [],
    realWorldExample: plan.realWorldExample ?? '',
    practiceIdeas: plan.practiceIdeas ?? [],
    homework: plan.homework ?? { description: '', deliverable: '' },
    sources: chunks.map((c) => ({ heading: c.heading, text: c.content.slice(0, SOURCE_CHARS) })),
    studentStruggles,
    taskTypes: lesson.course.taskTypes,
    locale: SAFE_LOCALES.includes(locale) ? locale : 'ka',
  };
}

async function sessionForStudent(studentId: string, sessionId: string) {
  const session = await prisma.mentorLessonSession.findUnique({
    where: { id: sessionId },
    include: { enrollment: { select: { studentId: true, courseId: true } } },
  });
  if (!session || session.enrollment.studentId !== studentId) throw new CourseMentorError(404, 'Lesson session not found.', 'NOT_FOUND');
  await assertCourseServing(session.enrollment.courseId);
  return session;
}

function toChatHistory(rows: { role: string; content: string }[]): AzureChatMessage[] {
  return rows.map((m) => ({ role: m.role === 'student' ? 'user' : 'assistant', content: m.content }));
}

// Public shape of a session (answer keys are never sent to the browser).
export async function getLessonSession(studentId: string, sessionId: string) {
  await sessionForStudent(studentId, sessionId);
  const s = await prisma.mentorLessonSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      lesson: { select: { id: true, position: true, title: true, kind: true, objectives: true, date: true } },
      messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, createdAt: true } },
      tasks: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, isHomework: true, difficulty: true, content: true, answer: true, attachment: true, score: true, feedback: true, submittedAt: true, gradedAt: true },
      },
    },
  });
  return { ...s, lesson: { ...s.lesson, date: s.lesson.date.toISOString().slice(0, 10) } };
}

export async function startLessonSession(studentId: string, courseId: string, lessonId: string, locale: string) {
  const enrollment = await assertEnrolled(studentId, courseId);
  await assertCourseServing(courseId);
  const lesson = await prisma.mentorLesson.findFirst({ where: { id: lessonId, courseId }, select: { id: true } });
  if (!lesson) throw new CourseMentorError(404, 'Lesson not found.', 'NOT_FOUND');

  const existing = await prisma.mentorLessonSession.findUnique({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } } });
  if (existing) return getLessonSession(studentId, existing.id);

  await consumeUsage(studentId, 'messages');
  const safeLocale = SAFE_LOCALES.includes(locale) ? locale : 'ka';
  const ctx = await loadLessonContext(enrollment.id, lessonId, safeLocale);
  const opening = await chatWithMini([
    { role: 'system', content: buildTutorSystemPrompt(ctx) },
    { role: 'user', content: OPENING_INSTRUCTION },
  ]);
  const session = await prisma.mentorLessonSession.create({
    data: { enrollmentId: enrollment.id, lessonId, locale: safeLocale, messages: { create: { role: 'mentor', content: opening } } },
  });
  return getLessonSession(studentId, session.id);
}

export async function sendStudentMessage(studentId: string, sessionId: string, text: string) {
  const session = await sessionForStudent(studentId, sessionId);
  if (session.status === 'COMPLETED') throw new CourseMentorError(409, 'This lesson is finished.', 'LESSON_DONE');
  const message = text.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!message) throw new CourseMentorError(400, 'Write a message.', 'EMPTY');
  await consumeUsage(studentId, 'messages');

  const history = await prisma.mentorLessonSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { messages: { orderBy: { createdAt: 'desc' }, take: HISTORY_TURNS, select: { role: true, content: true } } },
  });
  const turns = history.messages.reverse();
  // "Wrong answers" signal: recently graded tasks of this session below 50.
  const recentWrong = await prisma.mentorTask.count({
    where: { sessionId, gradedAt: { gte: new Date(Date.now() - 20 * 60_000) }, score: { lt: 50 } },
  });
  const escalate = shouldEscalate({ message, recentWrongAnswers: recentWrong }) && (await tryConsumeUsage(studentId, 'escalations'));

  const ctx = await loadLessonContext(session.enrollmentId, session.lessonId, session.locale, escalate ? 2 : 4);
  const messages: AzureChatMessage[] = [
    { role: 'system', content: buildTutorSystemPrompt(ctx) },
    ...toChatHistory(escalate ? turns.slice(-ESCALATED_HISTORY_TURNS) : turns),
    { role: 'user', content: message },
  ];
  const reply = escalate ? await chatWithMain(messages) : await chatWithMini(messages);

  await prisma.mentorAgentMessage.createMany({
    data: [
      { sessionId, role: 'student', content: message },
      { sessionId, role: 'mentor', content: reply },
    ],
  });
  return { reply, escalated: escalate };
}

const evaluationSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  objectivesReached: z.array(z.string().max(300)).max(10).default([]),
  strengths: z.array(z.string().max(300)).max(8).default([]),
  struggles: z.array(z.string().max(300)).max(8).default([]),
  nextSteps: z.array(z.string().max(300)).max(8).default([]),
  engagement: z.enum(['low', 'medium', 'high']).default('medium'),
});

// Ends the lesson: score = average of graded in-class + homework tasks,
// evaluation written by gpt-4o for the teacher (and shown to the student).
export async function finishLessonSession(studentId: string, sessionId: string) {
  const session = await sessionForStudent(studentId, sessionId);
  if (session.status === 'COMPLETED') return getLessonSession(studentId, sessionId);
  await consumeUsage(studentId, 'aiCalls');

  const full = await prisma.mentorLessonSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      lesson: { select: { title: true, objectives: true } },
      messages: { orderBy: { createdAt: 'asc' }, select: { role: true, content: true } },
      tasks: { select: { type: true, content: true, score: true, answerKey: true, feedback: true, gradedAt: true } },
    },
  });
  const chatExcerpt = full.messages
    .slice(-30)
    .map((m) => `${m.role === 'student' ? 'STUDENT' : 'MENTOR'}: ${m.content.slice(0, 600)}`)
    .join('\n');
  const taskResults = full.tasks.map((t) => ({
    title: (t.content as { title?: string }).title ?? t.type,
    type: t.type,
    score: t.score,
    mistakes: ((t.answerKey as { lastMistakes?: string[] }).lastMistakes ?? []).slice(0, 4),
  }));
  const evaluation = await jsonWithModel(
    'main',
    buildEvaluationPrompt({ locale: full.locale, lessonTitle: full.lesson.title, objectives: full.lesson.objectives, chatExcerpt, taskResults }),
    evaluationSchema,
    1500
  );
  const graded = full.tasks.filter((t) => t.score !== null);
  const score = graded.length ? graded.reduce((a, t) => a + (t.score ?? 0), 0) / graded.length : null;

  await prisma.mentorLessonSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED', completedAt: new Date(), score, evaluation },
  });
  return getLessonSession(studentId, sessionId);
}
