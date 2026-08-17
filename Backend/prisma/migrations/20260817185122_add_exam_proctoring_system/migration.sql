-- CreateEnum
CREATE TYPE "ExamSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExamQuestionType" AS ENUM ('MCQ', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "ExamSubmissionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FLAGGED');

-- AlterEnum
ALTER TYPE "BillingProductType" ADD VALUE 'AI_EXAM_PROCTORING';

-- AlterEnum
ALTER TYPE "UsageEventType" ADD VALUE 'EXAM_GRADING';

-- AlterTable
ALTER TABLE "usage_records" ADD COLUMN     "examSubmissionId" TEXT;

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topic" TEXT NOT NULL,
    "mcqCount" INTEGER NOT NULL DEFAULT 5,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" "ExamSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "candidateToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "examSessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ExamQuestionType" NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_submissions" (
    "id" TEXT NOT NULL,
    "examSessionId" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "candidateEmail" TEXT NOT NULL,
    "candidateToken" TEXT NOT NULL,
    "answers" JSONB,
    "mcqScore" DOUBLE PRECISION,
    "practicalScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "aiEvaluation" TEXT,
    "proctoringViolations" INTEGER NOT NULL DEFAULT 0,
    "status" "ExamSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "exam_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_candidateToken_key" ON "exam_sessions"("candidateToken");

-- CreateIndex
CREATE INDEX "exam_sessions_businessId_idx" ON "exam_sessions"("businessId");

-- CreateIndex
CREATE INDEX "exam_questions_examSessionId_idx" ON "exam_questions"("examSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_submissions_candidateToken_key" ON "exam_submissions"("candidateToken");

-- CreateIndex
CREATE INDEX "exam_submissions_examSessionId_idx" ON "exam_submissions"("examSessionId");

-- CreateIndex
CREATE INDEX "usage_records_examSubmissionId_idx" ON "usage_records"("examSubmissionId");

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_examSubmissionId_fkey" FOREIGN KEY ("examSubmissionId") REFERENCES "exam_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_submissions" ADD CONSTRAINT "exam_submissions_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
