-- AlterEnum
ALTER TYPE "ExamQuestionType" ADD VALUE 'CODE';

-- AlterTable
ALTER TABLE "exam_questions" ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "exam_sessions" ADD COLUMN     "rawContent" TEXT;

-- AlterTable
ALTER TABLE "exam_submissions" ADD COLUMN     "aiTextScore" DOUBLE PRECISION,
ADD COLUMN     "answerGrades" JSONB,
ADD COLUMN     "copyPasteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "integrityScore" DOUBLE PRECISION,
ADD COLUMN     "tabSwitches" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "adaptive_study_guides" (
    "id" TEXT NOT NULL,
    "examSubmissionId" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "weakTopics" JSONB NOT NULL,
    "generatedGuideText" TEXT NOT NULL,
    "retestExamSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adaptive_study_guides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "adaptive_study_guides_examSubmissionId_key" ON "adaptive_study_guides"("examSubmissionId");

-- AddForeignKey
ALTER TABLE "adaptive_study_guides" ADD CONSTRAINT "adaptive_study_guides_examSubmissionId_fkey" FOREIGN KEY ("examSubmissionId") REFERENCES "exam_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adaptive_study_guides" ADD CONSTRAINT "adaptive_study_guides_retestExamSessionId_fkey" FOREIGN KEY ("retestExamSessionId") REFERENCES "exam_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
