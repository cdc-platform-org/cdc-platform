-- CreateEnum
CREATE TYPE "CareerQuizAudience" AS ENUM ('SELF', 'CHILD');

-- CreateTable
CREATE TABLE "career_quiz_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "audience" "CareerQuizAudience" NOT NULL DEFAULT 'SELF',
    "interests" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "mainGoal" TEXT NOT NULL,
    "resultText" TEXT NOT NULL,
    "age" INTEGER,
    "ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_quiz_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "career_quiz_submissions_userId_createdAt_idx" ON "career_quiz_submissions"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "career_quiz_submissions" ADD CONSTRAINT "career_quiz_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
