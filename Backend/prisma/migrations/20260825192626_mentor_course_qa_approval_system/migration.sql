/*
  Warnings:

  - You are about to drop the column `published` on the `courses` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MentorApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CourseReviewAction" AS ENUM ('SUBMITTED', 'APPROVED_PUBLISHED', 'REQUESTED_REVISION', 'REJECTED');

-- AlterTable
-- Deliberately NOT a single DROP COLUMN "published" + ADD COLUMN "status"
-- (what `prisma migrate dev` generates by default) — that would silently
-- reset every existing course to the new column's DRAFT default, losing
-- the live/not-live distinction for the entire admin-authored catalog.
-- Add "status" first, backfill it FROM "published" while both columns
-- still exist, then drop "published" only once every row has the
-- corresponding status.
ALTER TABLE "courses" ADD COLUMN     "instructorId" TEXT,
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "courses" SET "status" = CASE WHEN "published" THEN 'PUBLISHED' ELSE 'DRAFT' END::"CourseStatus";

ALTER TABLE "courses" DROP COLUMN "published";

-- CreateTable
CREATE TABLE "mentor_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "bio" TEXT NOT NULL,
    "teachingTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MentorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_review_history" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "action" "CourseReviewAction" NOT NULL,
    "feedback" TEXT,
    "fromStatus" "CourseStatus" NOT NULL,
    "toStatus" "CourseStatus" NOT NULL,
    "actedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_review_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_applications_userId_idx" ON "mentor_applications"("userId");

-- CreateIndex
CREATE INDEX "mentor_applications_status_idx" ON "mentor_applications"("status");

-- CreateIndex
CREATE INDEX "course_review_history_courseId_idx" ON "course_review_history"("courseId");

-- CreateIndex
CREATE INDEX "courses_status_idx" ON "courses"("status");

-- CreateIndex
CREATE INDEX "courses_instructorId_idx" ON "courses"("instructorId");

-- AddForeignKey
ALTER TABLE "mentor_applications" ADD CONSTRAINT "mentor_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_applications" ADD CONSTRAINT "mentor_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_review_history" ADD CONSTRAINT "course_review_history_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_review_history" ADD CONSTRAINT "course_review_history_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
