-- AlterTable
ALTER TABLE "book_projects" ALTER COLUMN "priceGel" SET DEFAULT 1000;

-- CreateTable
CREATE TABLE "course_readiness_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "aiMentorScore" INTEGER NOT NULL DEFAULT 0,
    "attendanceScore" INTEGER NOT NULL DEFAULT 0,
    "assignmentsScore" INTEGER NOT NULL DEFAULT 0,
    "lecturerScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "aiCritique" TEXT,
    "lecturerNote" TEXT,
    "lecturerName" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_readiness_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_readiness_records_userId_idx" ON "course_readiness_records"("userId");

-- CreateIndex
CREATE INDEX "course_readiness_records_courseId_idx" ON "course_readiness_records"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_readiness_records_userId_courseId_key" ON "course_readiness_records"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "course_readiness_records" ADD CONSTRAINT "course_readiness_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_readiness_records" ADD CONSTRAINT "course_readiness_records_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "book_narration_artifacts_bookProjectId_pageNumber_revisionVersi" RENAME TO "book_narration_artifacts_bookProjectId_pageNumber_revisionV_key";

