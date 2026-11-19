/**
 * Course Mentor Agent — practice tasks, tests and homework.
 * Exports: generateTasks, submitTask, publicTask, TASKS_PER_REQUEST.
 *
 * Generation: in-class practice on gpt-4o-mini, homework on gpt-4o (it is
 * graded later and must be right). Answer keys stay in the database and are
 * never sent to the browser. Grading: QUIZ is checked deterministically
 * (no AI cost); everything else is graded by gpt-4o against the task's
 * rubric; images (design work) are passed to the model as vision input.
 */
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { callTextModel } from '../ai/aiAgentService';
import { uploadToSpace } from '../storage';
import { loadLessonContext } from './lessonRunner';
import { jsonWithModel } from './mentorModels';
import { parseModelJson } from './curriculumPlanner';
import { buildGradingPrompt, buildTaskGenerationPrompt } from './prompts/tutorPrompts';
import { consumeUsage } from './usageLimits';
import { assertCourseServing } from './enrollmentService';
import { CourseMentorError } from './types';

export const TASKS_PER_REQUEST = 4;
const MAX_ANSWER_CHARS = 20_000;

const taskTypeSchema = z.enum(['QUIZ', 'SHORT_ANSWER', 'CODING', 'DEBUGGING', 'MATCHING', 'DESIGN', 'PROJECT']);
const generatedSchema = z.object({
  tasks: z
    .array(
      z.object({
        type: taskTypeSchema,
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
        title: z.string().trim().min(1).max(300),
        instructions: z.string().trim().min(1).max(4000),
        options: z.array(z.string().trim().min(1).max(500)).optional(),
        correctOption: z.coerce.number().int().min(0).max(5).optional(),
        starterCode: z.string().max(6000).optional(),
        language: z.string().max(40).optional(),
        modelAnswer: z.string().trim().min(1).max(8000),
        rubric: z.array(z.string().trim().min(1).max(400)).min(1).max(8),
      })
    )
    .min(1)
    .max(8),
});

const gradeSchema = z.object({
  score: z.coerce.number().min(0).max(100),
  feedback: z.string().trim().min(1).max(3000),
  strengths: z.array(z.string().max(400)).max(6).default([]),
  mistakes: z.array(z.string().max(400)).max(6).default([]),
});

interface TaskContent { title: string; instructions: string; options?: string[]; starterCode?: string; language?: string }
interface AnswerKey { correctOption?: number; modelAnswer: string; rubric: string[]; lastMistakes?: string[] }

export function publicTask(t: { id: string; type: string; isHomework: boolean; difficulty: string; content: unknown; answer: string | null; attachment: string | null; score: number | null; feedback: string | null; submittedAt: Date | null; gradedAt: Date | null }) {
  return { ...t, attachment: t.attachment ? true : null };
}

async function ownedSession(studentId: string, sessionId: string) {
  const s = await prisma.mentorLessonSession.findUnique({
    where: { id: sessionId },
    include: { enrollment: { select: { studentId: true, courseId: true } } },
  });
  if (!s || s.enrollment.studentId !== studentId) throw new CourseMentorError(404, 'Lesson session not found.', 'NOT_FOUND');
  await assertCourseServing(s.enrollment.courseId);
  return s;
}

export async function generateTasks(studentId: string, sessionId: string, opts: { homework: boolean; difficulty?: 'easy' | 'medium' | 'hard' }) {
  const session = await ownedSession(studentId, sessionId);
  if (opts.homework) {
    const already = await prisma.mentorTask.count({ where: { sessionId, isHomework: true } });
    if (already > 0) throw new CourseMentorError(409, 'Homework for this lesson was already given.', 'HOMEWORK_EXISTS');
  } else if (session.status === 'COMPLETED') {
    throw new CourseMentorError(409, 'This lesson is finished.', 'LESSON_DONE');
  }
  await consumeUsage(studentId, 'aiCalls');

  // Adaptive difficulty: recent results in this session steer the level.
  const graded = await prisma.mentorTask.findMany({ where: { sessionId, score: { not: null } }, select: { score: true, answerKey: true }, orderBy: { gradedAt: 'desc' }, take: 6 });
  const avg = graded.length ? graded.reduce((a, t) => a + (t.score ?? 0), 0) / graded.length : null;
  const difficulty = opts.difficulty ?? (avg === null ? 'easy' : avg >= 85 ? 'hard' : avg >= 60 ? 'medium' : 'easy');
  const recentMistakes = graded.flatMap((t) => (t.answerKey as unknown as AnswerKey).lastMistakes ?? []).slice(0, 6);

  const ctx = await loadLessonContext(session.enrollmentId, session.lessonId, session.locale, 3);
  const draft = await jsonWithModel(
    opts.homework ? 'main' : 'mini',
    buildTaskGenerationPrompt(ctx, { count: opts.homework ? 2 : TASKS_PER_REQUEST, homework: opts.homework, difficulty, recentMistakes }),
    generatedSchema,
    4000
  );

  const created = [];
  for (const t of draft.tasks) {
    // A quiz without valid options/answer can't be auto-graded: grade it as text.
    const isQuiz = t.type === 'QUIZ' && t.options && t.options.length >= 2 && t.correctOption !== undefined && t.correctOption < t.options.length;
    const content: TaskContent = { title: t.title, instructions: t.instructions, ...(isQuiz ? { options: t.options } : {}), ...(t.starterCode ? { starterCode: t.starterCode } : {}), ...(t.language ? { language: t.language } : {}) };
    const answerKey: AnswerKey = { modelAnswer: t.modelAnswer, rubric: t.rubric, ...(isQuiz ? { correctOption: t.correctOption } : {}) };
    created.push(
      await prisma.mentorTask.create({
        data: {
          sessionId,
          type: isQuiz ? 'QUIZ' : t.type === 'QUIZ' ? 'SHORT_ANSWER' : t.type,
          isHomework: opts.homework,
          difficulty: t.difficulty,
          content: content as unknown as Prisma.InputJsonValue,
          answerKey: answerKey as unknown as Prisma.InputJsonValue,
        },
      })
    );
  }
  return created.map(publicTask);
}

export async function submitTask(
  studentId: string,
  taskId: string,
  input: { answer?: string; file?: { buffer: Buffer; mimetype: string; originalname: string } }
) {
  const task = await prisma.mentorTask.findUnique({ where: { id: taskId }, include: { session: { include: { lesson: { select: { title: true, objectives: true } } } } } });
  if (!task) throw new CourseMentorError(404, 'Task not found.', 'NOT_FOUND');
  const session = await ownedSession(studentId, task.sessionId);
  if (task.gradedAt && task.type === 'QUIZ') throw new CourseMentorError(409, 'This question is already answered.', 'ALREADY_ANSWERED');
  if (!task.isHomework && session.status === 'COMPLETED') throw new CourseMentorError(409, 'This lesson is finished.', 'LESSON_DONE');

  const content = task.content as unknown as TaskContent;
  const key = task.answerKey as unknown as AnswerKey;
  const answer = (input.answer ?? '').slice(0, MAX_ANSWER_CHARS);
  if (!answer.trim() && !input.file) throw new CourseMentorError(400, 'Write an answer or attach a file.', 'EMPTY');

  let attachment: string | null = task.attachment;
  if (input.file) {
    const stored = await uploadToSpace('private-media', {
      buffer: input.file.buffer,
      contentType: input.file.mimetype,
      filename: input.file.originalname,
      folder: `course-mentor/submissions/${task.sessionId}`,
    });
    attachment = stored.url;
  }

  let score: number;
  let feedback: string | null;
  let mistakes: string[] = [];
  if (task.type === 'QUIZ' && key.correctOption !== undefined) {
    // Deterministic, free: the chosen option index arrives as the answer.
    const chosen = Number(answer);
    const correct = chosen === key.correctOption;
    score = correct ? 100 : 0;
    // Correct: no text needed (the UI shows a check icon). Wrong: the right
    // option plus the explanation.
    feedback = correct ? null : `${content.options?.[key.correctOption] ?? ''}\n\n${key.modelAnswer}`;
    if (!correct) mistakes = [content.title];
  } else {
    await consumeUsage(studentId, 'aiCalls');
    const prompt = buildGradingPrompt({
      locale: session.locale,
      lessonTitle: task.session.lesson.title,
      objectives: task.session.lesson.objectives,
      taskType: task.type,
      title: content.title,
      instructions: content.instructions,
      modelAnswer: key.modelAnswer,
      rubric: key.rubric,
      answer: answer || '(see attached image)',
    });
    const image = input.file && /^image\/(png|jpe?g|webp)$/.test(input.file.mimetype)
      ? [{ mimeType: input.file.mimetype, data: input.file.buffer.toString('base64') }]
      : undefined;
    const graded = image
      ? parseModelJson(await callTextModel(prompt, 0.2, image, { maxOutputTokens: 1500, timeoutMs: 120_000 }), gradeSchema)
      : await jsonWithModel('main', prompt, gradeSchema, 1500);
    score = graded.score;
    feedback = graded.feedback;
    mistakes = graded.mistakes;
  }

  const updated = await prisma.mentorTask.update({
    where: { id: taskId },
    data: {
      answer: answer || null,
      attachment,
      score,
      feedback,
      submittedAt: new Date(),
      gradedAt: new Date(),
      answerKey: { ...key, lastMistakes: mistakes } as unknown as Prisma.InputJsonValue,
    },
  });
  return publicTask(updated);
}
