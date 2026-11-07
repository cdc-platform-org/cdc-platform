import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { callTextModel } from './aiAgentService';
import { minimizeForAi } from './educatorPrivacyService';
import { TeacherQuizQuestionType, Prisma } from '@prisma/client';
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

// Fix D9: getSubmissionDetailForTeacher used to call gradeFreeTextAnswer
// fresh on every single detail view — repeated AI cost, and a non-
// deterministic LLM call meant the teacher could see a different verdict
// on the same submission from one view to the next. submitTeacherQuiz
// below already computes each question's verdict exactly once, at
// submission time — it just never used to persist that computation past
// the aggregate score. It now does (gradingResults), and this function
// reads it back instead of re-grading, with a one-time lazy-grade-and-
// persist fallback for historical rows that predate the field (see
// computeAndPersistGradingResults).
const gradingResultSchema = z.object({
  questionId: z.string(),
  correct: z.boolean(),
  feedback: z.string().optional(),
  gradingFailed: z.boolean().optional(),
});
const gradingResultsArraySchema = z.array(gradingResultSchema);

function parseGradingResults(raw: unknown): QuizAnswerResult[] | null {
  if (raw == null) return null;
  const parsed = gradingResultsArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function gradeQuestion(
  question: { id: string; type: TeacherQuizQuestionType; correctAnswer: string; question: string },
  studentAnswer: string,
  language: 'ka' | 'en'
): Promise<QuizAnswerResult> {
  const trimmed = studentAnswer.trim();
  if (question.type === TeacherQuizQuestionType.MULTIPLE_CHOICE) {
    const correct = trimmed.toUpperCase() === question.correctAnswer.trim().toUpperCase();
    return { questionId: question.id, correct };
  }
  if (!trimmed) return { questionId: question.id, correct: false };
  const graded = await gradeFreeTextAnswer(question.question, question.correctAnswer, trimmed, language);
  return { questionId: question.id, correct: graded.correct, feedback: graded.feedback, gradingFailed: graded.gradingFailed };
}

// Historical rows submitted before gradingResults existed have no persisted
// verdicts — grade them once, then persist so every subsequent read (by
// this teacher or anyone else viewing the same submission) reuses the
// result instead of re-grading. The guarded updateMany only writes if the
// column is still unset, so a race between two near-simultaneous first
// views converges on a single persisted result (whichever request's write
// lands first) rather than each independently re-grading forever — the
// second request just re-reads what the first one persisted.
async function computeAndPersistGradingResults(
  submissionId: string,
  quiz: { language: string; questions: { id: string; type: TeacherQuizQuestionType; correctAnswer: string; question: string }[] },
  answerMap: Record<string, unknown>
): Promise<QuizAnswerResult[]> {
  const language = quiz.language === 'ka' ? 'ka' : 'en';
  const computed = await Promise.all(
    quiz.questions.map((question) => {
      const raw = answerMap[question.id];
      const studentAnswer = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
      return gradeQuestion(question, studentAnswer, language);
    })
  );

  // DbNull (actual SQL NULL) is the "never graded yet" sentinel — this
  // column is only ever left unset or written once, never explicitly set
  // to a JSON `null` literal, so DbNull is the correct guard here (not
  // Prisma's separate JsonNull, which represents a stored JSON null value).
  const claim = await prisma.teacherQuizSubmission.updateMany({
    where: { id: submissionId, gradingResults: { equals: Prisma.DbNull } },
    data: { gradingResults: computed as unknown as Prisma.InputJsonValue },
  });
  if (claim.count > 0) return computed;

  // Lost the race — another request already persisted a result first;
  // re-read and use that canonical value instead of our own (possibly
  // slightly different, since free-text grading is a non-deterministic AI
  // call) locally-computed one, so every reader converges on one answer.
  const persisted = await prisma.teacherQuizSubmission.findUnique({ where: { id: submissionId }, select: { gradingResults: true } });
  return parseGradingResults(persisted?.gradingResults) ?? computed;
}

export async function getSubmissionDetailForTeacher(teacherId: string, quizId: string, submissionId: string) {
  const quiz = await prisma.teacherQuiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!quiz || quiz.teacherId !== teacherId) throw new TeacherQuizError('Quiz not found.', 404);

  const submission = await prisma.teacherQuizSubmission.findFirst({
    where: { id: submissionId, quizId },
  });
  if (!submission) throw new TeacherQuizError('Submission not found.', 404);

  const answerMap = submission.answers && typeof submission.answers === 'object' && !Array.isArray(submission.answers)
    ? (submission.answers as Record<string, unknown>)
    : {};

  let gradingResults = parseGradingResults(submission.gradingResults);
  if (!gradingResults) {
    gradingResults = await computeAndPersistGradingResults(submission.id, quiz, answerMap);
  }
  const gradingByQuestionId = new Map(gradingResults.map((r) => [r.questionId, r]));

  const questions = quiz.questions.map((question) => {
    const rawStudentAnswer = answerMap[question.id];
    const studentAnswer = typeof rawStudentAnswer === 'string' ? rawStudentAnswer : rawStudentAnswer == null ? '' : String(rawStudentAnswer);
    const trimmedStudentAnswer = studentAnswer.trim();
    const graded = gradingByQuestionId.get(question.id);

    const correct = graded?.correct ?? null;
    const answerStatus: 'correct' | 'incorrect' | 'unanswered' = !trimmedStudentAnswer ? 'unanswered' : correct ? 'correct' : 'incorrect';

    return {
      id: question.id,
      question: question.question,
      studentAnswer,
      correctAnswer: question.correctAnswer,
      correct,
      answerStatus,
      feedback: graded?.feedback,
    };
  });

  return {
    submission: {
      id: submission.id,
      studentName: submission.studentName,
      score: submission.score,
      submittedAt: submission.submittedAt,
    },
    questions,
  };
}

const freeTextGradeSchema = z.object({ correct: z.boolean(), feedback: z.string().min(1) });

async function gradeFreeTextAnswer(question: string, modelAnswer: string, studentAnswer: string, language: 'ka' | 'en') {
  const lang = language === 'ka' ? 'Georgian' : 'English';
  // D8: only this AI-bound copy is minimized — the submission's persisted
  // `answers` field (written by the caller) keeps the student's original,
  // unaltered answer. See the module comment on minimizeForAi for what it
  // does and doesn't catch.
  const minimizedAnswer = minimizeForAi(studentAnswer);
  const prompt = `A student answered this question: "${question}"

Model answer / key points: ${modelAnswer}

Student's answer: ${minimizedAnswer || '(no answer given)'}

Decide if the student's answer is substantively correct — it doesn't need to match word-for-word, just capture the key point(s). Write one short, encouraging sentence of feedback in ${lang}.

Respond with strict JSON: {"correct": boolean, "feedback": string}`;

  try {
    const raw = await callTextModel(prompt, 0.3);
    const parsed = freeTextGradeSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { ...parsed.data, gradingFailed: false as const };
  } catch {
    // Falls through to the ungraded default below — a single question's AI
    // grading hiccup shouldn't fail the student's whole submission. Marked
    // gradingFailed so this is never confused with a genuinely-graded
    // "incorrect" verdict downstream (Fix D9) — the score still counts it
    // as incorrect (unchanged scoring behavior), but the persisted record
    // is honest about why.
  }
  return {
    correct: false,
    feedback: language === 'ka' ? 'ავტომატური შეფასება ვერ მოხერხდა ამ კითხვისთვის.' : 'Automatic grading was unavailable for this question.',
    gradingFailed: true as const,
  };
}

export interface QuizAnswerResult {
  questionId: string;
  correct: boolean;
  feedback?: string;
  gradingFailed?: boolean;
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
      results.push({ questionId: q.id, correct: graded.correct, feedback: graded.feedback, gradingFailed: graded.gradingFailed });
    }
  }

  const correctCount = results.filter((r) => r.correct).length;
  const score = Math.round((correctCount / quiz.questions.length) * 100);

  // Fix D9: persist the verdicts computed just above (previously discarded
  // after only the aggregate score was kept) so getSubmissionDetailForTeacher
  // never has to re-grade free-text answers on every view.
  const submission = await prisma.teacherQuizSubmission.create({
    data: { quizId: quiz.id, studentName: studentName.trim().slice(0, 200), answers, score, gradingResults: results as unknown as Prisma.InputJsonValue },
  });

  return {
    submissionId: submission.id,
    score,
    correctCount,
    total: quiz.questions.length,
    results,
  };
}
