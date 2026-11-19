-- CreateEnum
CREATE TYPE "MentorCourseStatus" AS ENUM ('DRAFT', 'PLANNING', 'PLAN_READY', 'ACTIVE', 'PLAN_FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MentorDocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MentorLessonKind" AS ENUM ('LEARN', 'PRACTICE', 'REVIEW', 'PROJECT', 'ASSESSMENT');

-- CreateTable
CREATE TABLE "mentor_courses" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "instructions" TEXT,
    "teachingLocale" TEXT NOT NULL DEFAULT 'ka',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "weekdays" INTEGER[],
    "minutesPerLesson" INTEGER NOT NULL,
    "excludedDates" TEXT[],
    "status" "MentorCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "planError" TEXT,
    "planSummary" JSONB,
    "planProgress" JSONB,
    "planGeneratedAt" TIMESTAMP(3),
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_source_documents" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageUrl" TEXT,
    "status" "MentorDocumentStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "outline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_source_chunks" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],

    CONSTRAINT "mentor_source_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "mentor_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_lessons" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" "MentorLessonKind" NOT NULL DEFAULT 'LEARN',
    "title" TEXT NOT NULL,
    "objectives" TEXT[],
    "topics" TEXT[],
    "plan" JSONB NOT NULL,
    "sourceChunkIds" TEXT[],
    "teacherEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mentor_courses_joinCode_key" ON "mentor_courses"("joinCode");

-- CreateIndex
CREATE INDEX "mentor_courses_teacherId_createdAt_idx" ON "mentor_courses"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "mentor_source_documents_courseId_idx" ON "mentor_source_documents"("courseId");

-- CreateIndex
CREATE INDEX "mentor_source_chunks_courseId_idx" ON "mentor_source_chunks"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_source_chunks_documentId_position_key" ON "mentor_source_chunks"("documentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_modules_courseId_position_key" ON "mentor_modules"("courseId", "position");

-- CreateIndex
CREATE INDEX "mentor_lessons_courseId_date_idx" ON "mentor_lessons"("courseId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_lessons_courseId_position_key" ON "mentor_lessons"("courseId", "position");

-- AddForeignKey
ALTER TABLE "mentor_courses" ADD CONSTRAINT "mentor_courses_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_source_documents" ADD CONSTRAINT "mentor_source_documents_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "mentor_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_source_chunks" ADD CONSTRAINT "mentor_source_chunks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "mentor_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_source_chunks" ADD CONSTRAINT "mentor_source_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "mentor_source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_modules" ADD CONSTRAINT "mentor_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "mentor_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_lessons" ADD CONSTRAINT "mentor_lessons_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "mentor_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_lessons" ADD CONSTRAINT "mentor_lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "mentor_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

