import { ExamQuestion, ExamSession, ExamSubmission } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { generateMcqExplanations } from './examProctoringService';
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

export async function ensureMcqExplanations(session: ExamSession, questions: ExamQuestion[]): Promise<ExamQuestion[]> {
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
    await job;
  } catch (err) {
    console.error('[examResults] generateMcqExplanations failed:', err);
    return questions;
  }
  return prisma.examQuestion.findMany({ where: { examSessionId: session.id }, orderBy: { order: 'asc' } });
}
