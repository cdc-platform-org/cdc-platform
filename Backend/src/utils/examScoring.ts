// Total score for an AI Proctored Exam attempt: every question counts the
// same. A multiple-choice question is worth 1 (right) or 0 (wrong); an
// AI-graded open question (PRACTICAL/CODE) is worth its AI score / 100, so
// partial credit is possible. With 15 multiple-choice questions and one open
// question each question is worth 100 / 16 = 6.25 points.
//
// Before 2026-11-10 the total was the average of the multiple-choice
// percentage and the open-question score, so one open question weighed as
// much as all multiple-choice questions together (5 of 15 right and 0 on
// the open question gave 17%), which teachers found confusing.
//
// Open questions that were not graded (AI failure, or a disqualified
// attempt, which is never AI-graded) are left out, as before, rather than
// counted as zero: the teacher reviews those by hand.
export function computeExamTotalScore(params: { mcqCorrect: number; mcqTotal: number; openScores: number[] }): number | null {
  const questionCount = params.mcqTotal + params.openScores.length;
  if (questionCount === 0) return null;
  const earned = params.mcqCorrect + params.openScores.reduce((sum, s) => sum + Math.max(0, Math.min(100, s)) / 100, 0);
  return Math.round((earned / questionCount) * 100);
}

// Points one question is worth in the total (for display: "each question
// = 6.25 points").
export function pointsPerQuestion(questionCount: number): number | null {
  if (questionCount <= 0) return null;
  return Math.round((100 / questionCount) * 100) / 100;
}
