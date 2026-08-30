import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { callTextModel } from './aiAgentService';
import { TeacherQuizQuestionType } from '@prisma/client';
import type { StructuredTestQuestion } from './educatorHubAiService';

// ============================================================
// AI Educator VIP Hub — shareable no-login student quizzes. Turns a
// generateTestAndAnswerKey() result (Module 1) into a TeacherQuiz a teacher
// can share as a link; a student opens it, types just their name, answers,
// and gets instantly graded — see schema.prisma's TeacherQuiz comment for
// why this is a lean sibling of ExamSession rather than reusing it.
// ============================================================

export class TeacherQuizError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'TeacherQuizError';
    this.status = status;
  }
}

export interface CreateTeacherQuizParams {
  teacherId: string;
  title: string;
  language: 'ka' | 'en';
  questions: StructuredTestQuestion[];
}

export async function createTeacherQuiz(params: CreateTeacherQuizParams) {
  const quiz = await prisma.teacherQuiz.create({
    data: {
      teacherId: params.teacherId,
      title: params.title,
      language: params.language,
      questions: {
        create: params.questions.map((q, index) => ({
          order: index,
          type: q.type === 'MULTIPLE_CHOICE' ? TeacherQuizQuestionType.MULTIPLE_CHOICE : TeacherQuizQuestionType.FREE_TEXT,
          question: q.question,
          options: q.options ?? undefined,
          correctAnswer: q.correctAnswer,
        })),
      },
    },
  });
  return quiz;
}

// Public shape for the student-facing quiz page — correctAnswer is
// deliberately withheld, same "never trust the client with the answer key"
// boundary as examProctoringService's own candidate-facing question shape.
export async function getPublicQuiz(shareToken: string) {
  const quiz = await prisma.teacherQuiz.findUnique({
    where: { shareToken },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) return null;
  return {
    title: quiz.title,
    language: quiz.language,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options as Record<string, string> | null,
    })),
  };
}

// Teacher-facing results list for their own quiz — shown in the Educator
// Hub dashboard after sharing.
export async function getQuizSubmissionsForTeacher(teacherId: string, quizId: string) {
  const quiz = await prisma.teacherQuiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.teacherId !== teacherId) throw new TeacherQuizError('Quiz not found.', 404);
  return prisma.teacherQuizSubmission.findMany({
    where: { quizId },
    orderBy: { submittedAt: 'desc' },
    select: { id: true, studentName: true, score: true, submittedAt: true },
  });
}

const freeTextGradeSchema = z.object({ correct: z.boolean(), feedback: z.string().min(1) });

async function gradeFreeTextAnswer(question: string, modelAnswer: string, studentAnswer: string, language: 'ka' | 'en') {
  const lang = language === 'ka' ? 'Georgian' : 'English';
  const prompt = `A student answered this question: "${question}"

Model answer / key points: ${modelAnswer}

Student's answer: ${studentAnswer || '(no answer given)'}

Decide if the student's answer is substantively correct — it doesn't need to match word-for-word, just capture the key point(s). Write one short, encouraging sentence of feedback in ${lang}.

Respond with strict JSON: {"correct": boolean, "feedback": string}`;

  try {
    const raw = await callTextModel(prompt, 0.3);
    const parsed = freeTextGradeSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // Falls through to the ungraded default below — a single question's AI
    // grading hiccup shouldn't fail the student's whole submission.
  }
  return { correct: false, feedback: language === 'ka' ? 'ავტომატური შეფასება ვერ მოხერხდა ამ კითხვისთვის.' : 'Automatic grading was unavailable for this question.' };
}

export interface QuizAnswerResult {
  questionId: string;
  correct: boolean;
  feedback?: string;
}

export async function submitTeacherQuiz(shareToken: string, studentName: string, answers: Record<string, string>) {
  const quiz = await prisma.teacherQuiz.findUnique({
    where: { shareToken },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz) throw new TeacherQuizError('This quiz link is invalid or has been removed.', 404);
  if (quiz.questions.length === 0) throw new TeacherQuizError('This quiz has no questions.', 400);

  const language = quiz.language === 'ka' ? 'ka' : 'en';
  const results: QuizAnswerResult[] = [];

  for (const q of quiz.questions) {
    const studentAnswer = (answers[q.id] ?? '').trim();
    if (q.type === TeacherQuizQuestionType.MULTIPLE_CHOICE) {
      const correct = studentAnswer.toUpperCase() === q.correctAnswer.trim().toUpperCase();
      results.push({ questionId: q.id, correct });
    } else {
      const graded = await gradeFreeTextAnswer(q.question, q.correctAnswer, studentAnswer, language);
      results.push({ questionId: q.id, correct: graded.correct, feedback: graded.feedback });
    }
  }

  const correctCount = results.filter((r) => r.correct).length;
  const score = Math.round((correctCount / quiz.questions.length) * 100);

  const submission = await prisma.teacherQuizSubmission.create({
    data: { quizId: quiz.id, studentName: studentName.trim().slice(0, 200), answers, score },
  });

  return {
    submissionId: submission.id,
    score,
    correctCount,
    total: quiz.questions.length,
    results,
  };
}
