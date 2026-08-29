-- CreateEnum
CREATE TYPE "TutorLearningGoal" AS ENUM ('TRAVEL', 'TECHNICAL_IT', 'BUSINESS', 'ACADEMIC', 'GENERAL_DAILY', 'INTERVIEW_PREP');

-- CreateEnum
CREATE TYPE "TutorContentFlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "BogPaymentPurpose" ADD VALUE 'ENGLISH_TUTOR_SUBSCRIPTION';

-- AlterTable
ALTER TABLE "tutor_lessons" ADD COLUMN     "adminApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "adminEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "adminReviewedAt" TIMESTAMP(3),
ADD COLUMN     "adminReviewedById" TEXT,
ADD COLUMN     "learningGoal" "TutorLearningGoal";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tutorLearningGoal" "TutorLearningGoal",
ADD COLUMN     "tutorSubscriptionAutoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tutorSubscriptionPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "tutorTrialEndDate" TIMESTAMP(3),
ADD COLUMN     "tutorTrialStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_tutor_resume_state" (
    "userId" TEXT NOT NULL,
    "lastLessonId" TEXT,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "audioTimestampSec" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tutor_resume_state_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "tutor_content_flags" (
    "id" TEXT NOT NULL,
    "tutorLessonId" TEXT,
    "userTutorProgressId" TEXT,
    "flaggedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TutorContentFlagStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_content_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_prompt_overrides" (
    "id" TEXT NOT NULL,
    "taskType" "TutorTaskType" NOT NULL,
    "systemPromptOverride" TEXT,
    "temperatureOverride" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT NOT NULL,

    CONSTRAINT "tutor_prompt_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutor_content_flags_status_createdAt_idx" ON "tutor_content_flags"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_prompt_overrides_taskType_key" ON "tutor_prompt_overrides"("taskType");

-- CreateIndex
CREATE INDEX "tutor_lessons_learningGoal_idx" ON "tutor_lessons"("learningGoal");

-- AddForeignKey
ALTER TABLE "tutor_lessons" ADD CONSTRAINT "tutor_lessons_adminReviewedById_fkey" FOREIGN KEY ("adminReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tutor_resume_state" ADD CONSTRAINT "user_tutor_resume_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_content_flags" ADD CONSTRAINT "tutor_content_flags_tutorLessonId_fkey" FOREIGN KEY ("tutorLessonId") REFERENCES "tutor_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_content_flags" ADD CONSTRAINT "tutor_content_flags_userTutorProgressId_fkey" FOREIGN KEY ("userTutorProgressId") REFERENCES "user_tutor_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_content_flags" ADD CONSTRAINT "tutor_content_flags_flaggedByUserId_fkey" FOREIGN KEY ("flaggedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_content_flags" ADD CONSTRAINT "tutor_content_flags_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_prompt_overrides" ADD CONSTRAINT "tutor_prompt_overrides_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
