import { ExamQuestion, ExamSession, ExamSubmission } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateMcqExplanations, repairGarbledTexts } from './examProctoringService';
import { hasGarbledGeorgian } from '../utils/georgianTextCheck';
import { shuffleQuestionsForSubmission, canonicalToDisplayedLetter, isOptionMap, OptionMap } from '../utils/examShuffle';

// Student-facing results for the AI Proctored Exam: score plus every
// question with the student's answer, the correct answer and an
// explanation. Built in the student's OWN shuffled layout (same question
// order and A-D letters they saw), so "you chose B, the answer is D"
// matches their screen. Shown on the exam page right after submit, on the
// /exam/result/<token> page, and in the results email.

export interface CandidateResultQuestion {
  number: number;
  type: 'MCQ' | 'PRACTICAL' | 'CODE';
  question: string;
  // MCQ only, re-lettered for this student.
  options: OptionMap | null;
  // MCQ: the letter the student chose (their layout), or null if skipped.
  // PRACTICAL/CODE: the text they wrote.
  candidateAnswer: string | null;
  // MCQ only: the correct letter in the student's layout.
  correctAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  // PRACTICAL/CODE only.
  aiScore: number | null;
  aiFeedback: string | null;
  // PRACTICAL/CODE only: what a strong answer should contain (the grading rubric).
  expectedAnswer: string | null;
}

export interface CandidateResults {
  examTitle: string;
  candidateName: string;
  totalScore: number | null;
  mcqScore: number | null;
  practicalScore: number | null;
  correctCount: number;
  mcqTotal: number;
  // Hit the violation limit / time limit: open answers weren't AI-graded and
  // the teacher reviews the attempt.
  flagged: boolean;
  completedAt: string | null;
  questions: CandidateResultQuestion[];
}

interface StoredGrade {
  questionId: string;
  aiScore: number | null;
  aiFeedback: string | null;
}

export function buildCandidateResults(session: ExamSession, submission: ExamSubmission, questions: ExamQuestion[]): CandidateResults {
  const answers = (submission.answers ?? {}) as Record<string, string>;
  const grades = Array.isArray(submission.answerGrades) ? (submission.answerGrades as unknown as StoredGrade[]) : [];
  const gradeById = new Map(grades.map((g) => [g.questionId, g]));
  const token = submission.candidateToken;

  const ordered = shuffleQuestionsForSubmission(questions, token);
  let correctCount = 0;
  let mcqTotal = 0;
  const out: CandidateResultQuestion[] = ordered.map((q, i) => {
    const type = q.type as CandidateResultQuestion['type'];
    if (type === 'MCQ') {
      mcqTotal += 1;
      const chosenCanonical = answers[q.id] ?? '';
      const isCorrect = chosenCanonical !== '' && chosenCanonical === q.correctAnswer;
      if (isCorrect) correctCount += 1;
      return {
        number: i + 1,
        type,
        question: q.question,
        options: isOptionMap(q.options) ? q.options : null,
        candidateAnswer: chosenCanonical ? canonicalToDisplayedLetter(token, q.id, chosenCanonical) : null,
        correctAnswer: q.correctAnswer ? canonicalToDisplayedLetter(token, q.id, q.correctAnswer) : null,
        isCorrect,
        explanation: q.explanation ?? null,
        aiScore: null,
        aiFeedback: null,
        expectedAnswer: null,
      };
    }
    const grade = gradeById.get(q.id);
    return {
      number: i + 1,
      type,
      question: q.question,
      options: null,
      candidateAnswer: answers[q.id] ?? null,
      correctAnswer: null,
      isCorrect: null,
      explanation: null,
      aiScore: grade?.aiScore ?? null,
      aiFeedback: grade?.aiFeedback ?? null,
      expectedAnswer: q.correctAnswer ?? null,
    };
  });

  return {
    examTitle: session.title,
    candidateName: submission.candidateName,
    totalScore: submission.totalScore,
    mcqScore: submission.mcqScore,
    practicalScore: submission.practicalScore,
    correctCount,
    mcqTotal,
    flagged: submission.status === 'FLAGGED',
    completedAt: submission.completedAt ? submission.completedAt.toISOString() : null,
    questions: out,
  };
}

// Exams created before explanations were generated with the questions have
// none. The first submission fills them in with one AI call and stores them
// on the question rows, so every later student (and the email) reuses them.
// Concurrent submissions of the same exam in this process share one call.
// Best-effort: on any failure the results are simply shown without
// explanations.
const inFlight = new Map<string, Promise<void>>();

// opts.timeoutMs: stop waiting after this long (the submit request uses it
// so students are never kept waiting on a slow AI call); the explanations
// keep generating in the background and are saved for later views/emails.
export async function ensureMcqExplanations(
  session: ExamSession,
  questions: ExamQuestion[],
  opts: { timeoutMs?: number } = {}
): Promise<ExamQuestion[]> {
  const missing = questions.filter((q) => q.type === 'MCQ' && !q.explanation && q.correctAnswer && isOptionMap(q.options));
  if (missing.length === 0) return questions;

  let job = inFlight.get(session.id);
  if (!job) {
    job = (async () => {
      const generated = await generateMcqExplanations({
        topic: session.topic,
        questions: missing.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options as OptionMap,
          correctAnswer: q.correctAnswer as string,
        })),
      });
      await Promise.all(
        Object.entries(generated).map(([id, explanation]) =>
          // Only fill an empty slot, never overwrite an existing explanation.
          prisma.examQuestion.updateMany({ where: { id, explanation: null }, data: { explanation } })
        )
      );
    })().finally(() => inFlight.delete(session.id));
    inFlight.set(session.id, job);
  }

  try {
    if (opts.timeoutMs != null) {
      const finished = await Promise.race([
        job.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), opts.timeoutMs)),
      ]);
      if (!finished) {
        job.catch((err) => console.error('[examResults] generateMcqExplanations failed:', err));
        return questions;
      }
    } else {
      await job;
    }
  } catch (err) {
    console.error('[examResults] generateMcqExplanations failed:', err);
    return questions;
  }
  return prisma.examQuestion.findMany({ where: { examSessionId: session.id }, orderBy: { order: 'asc' } });
}

// Exams generated before the Georgian-text check existed (or where the
// model's repair failed) can still hold garbled Georgian words. The first
// time such an exam is opened (by a student starting it, or the teacher
// viewing it) the broken fields are repaired with one AI call and saved on
// the question rows, so everyone after that sees clean text. Concurrent
// callers share one repair; on any failure the questions are returned
// unchanged. Callers that must stay fast pass timeoutMs: the repair keeps
// running in the background and the next request gets the fixed text.
const repairInFlight = new Map<string, Promise<void>>();

export async function ensureCleanQuestionText(sessionId: string, opts: { timeoutMs?: number } = {}): Promise<void> {
  let job = repairInFlight.get(sessionId);
  if (!job) {
    job = (async () => {
      const questions = await prisma.examQuestion.findMany({ where: { examSessionId: sessionId } });
      const fields: Record<string, string> = {};
      for (const q of questions) {
        fields[`${q.id}|question`] = q.question;
        if (q.explanation) fields[`${q.id}|explanation`] = q.explanation;
        if (q.type !== 'MCQ' && q.correctAnswer) fields[`${q.id}|correctAnswer`] = q.correctAnswer;
        if (isOptionMap(q.options)) {
          for (const letter of ['A', 'B', 'C', 'D'] as const) fields[`${q.id}|option|${letter}`] = q.options[letter];
        }
      }
      if (!Object.values(fields).some((t) => hasGarbledGeorgian(t))) return;
      const fixed = await repairGarbledTexts(fields);
      for (const q of questions) {
        const get = (key: string) => fixed[`${q.id}|${key}`];
        const data: Record<string, unknown> = {};
        if (get('question')) data.question = get('question');
        if (get('explanation')) data.explanation = get('explanation');
        if (get('correctAnswer')) data.correctAnswer = get('correctAnswer');
        if (isOptionMap(q.options)) {
          const opts = q.options;
          const next = { A: get('option|A') ?? opts.A, B: get('option|B') ?? opts.B, C: get('option|C') ?? opts.C, D: get('option|D') ?? opts.D };
          if (next.A !== opts.A || next.B !== opts.B || next.C !== opts.C || next.D !== opts.D) data.options = next;
        }
        if (Object.keys(data).length > 0) await prisma.examQuestion.update({ where: { id: q.id }, data });
      }
    })().finally(() => repairInFlight.delete(sessionId));
    repairInFlight.set(sessionId, job);
  }
  const guarded = job.catch((err) => console.error('[examResults] ensureCleanQuestionText failed:', err));
  if (opts.timeoutMs == null) return guarded;
  await Promise.race([guarded, new Promise<void>((resolve) => setTimeout(resolve, opts.timeoutMs))]);
}
