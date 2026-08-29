-- CreateEnum
CREATE TYPE "TutorTaskType" AS ENUM ('READING', 'WRITING', 'GRAMMAR', 'VOCABULARY', 'QUIZ', 'LISTENING', 'DIALOGUE');

-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "TutorSubscriptionTier" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "TutorProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tutorNativeLang" TEXT,
ADD COLUMN     "tutorSubscriptionTier" "TutorSubscriptionTier" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "tutor_lessons" (
    "id" TEXT NOT NULL,
    "taskType" "TutorTaskType" NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "nativeLang" TEXT NOT NULL,
    "topic" TEXT,
    "content" JSONB NOT NULL,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "generatedForUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tutor_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tutorLessonId" TEXT NOT NULL,
    "status" "TutorProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "responseData" JSONB,
    "feedback" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_tutor_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_lesson_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_lesson_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_lessons_generatedForUserId_taskType_createdAt_idx" ON "tutor_lessons"("generatedForUserId", "taskType", "createdAt");

-- CreateIndex
CREATE INDEX "user_tutor_progress_userId_status_idx" ON "user_tutor_progress"("userId", "status");

-- CreateIndex
CREATE INDEX "user_tutor_progress_tutorLessonId_idx" ON "user_tutor_progress"("tutorLessonId");

-- CreateIndex
CREATE INDEX "tutor_lesson_generations_userId_createdAt_idx" ON "tutor_lesson_generations"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "tutor_lessons" ADD CONSTRAINT "tutor_lessons_generatedForUserId_fkey" FOREIGN KEY ("generatedForUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tutor_progress" ADD CONSTRAINT "user_tutor_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tutor_progress" ADD CONSTRAINT "user_tutor_progress_tutorLessonId_fkey" FOREIGN KEY ("tutorLessonId") REFERENCES "tutor_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_lesson_generations" ADD CONSTRAINT "tutor_lesson_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
