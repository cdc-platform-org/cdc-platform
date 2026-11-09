-- Exam results for students: per-question explanation + a per-exam switch
-- for showing/emailing results to the student. Purely additive: one
-- nullable column and one column with a default. No existing row changes.
ALTER TABLE "exam_sessions" ADD COLUMN "showResultsToCandidate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "exam_questions" ADD COLUMN "explanation" TEXT;
