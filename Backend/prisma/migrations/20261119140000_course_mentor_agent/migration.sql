-- CreateEnum
CREATE TYPE "MentorCourseStatus" AS ENUM ('DRAFT', 'PLANNING', 'PLAN_READY', 'ACTIVE', 'PLAN_FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MentorDocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MentorLessonKind" AS ENUM ('LEARN', 'PRACTICE', 'REVIEW', 'PROJECT', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "MentorSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MentorTaskType" AS ENUM ('QUIZ', 'SHORT_ANSWER', 'ESSAY', 'CALCULATION', 'CASE_STUDY', 'PRACTICAL', 'CODING', 'DEBUGGING', 'MATCHING', 'DESIGN', 'PROJECT');

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
    "taskTypes" TEXT[],
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

-- CreateTable
CREATE TABLE "mentor_enrollments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mentor_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_lesson_sessions" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "MentorSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "locale" TEXT NOT NULL DEFAULT 'ka',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "evaluation" JSONB,

    CONSTRAINT "mentor_lesson_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_agent_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_tasks" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "MentorTaskType" NOT NULL,
    "isHomework" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "content" JSONB NOT NULL,
    "answerKey" JSONB NOT NULL,
    "answer" TEXT,
    "attachment" TEXT,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_usage_days" (
    "studentId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "escalations" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mentor_usage_days_pkey" PRIMARY KEY ("studentId","day")
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

-- CreateIndex
CREATE INDEX "mentor_enrollments_studentId_idx" ON "mentor_enrollments"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_enrollments_courseId_studentId_key" ON "mentor_enrollments"("courseId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_lesson_sessions_enrollmentId_lessonId_key" ON "mentor_lesson_sessions"("enrollmentId", "lessonId");

-- CreateIndex
CREATE INDEX "mentor_agent_messages_sessionId_createdAt_idx" ON "mentor_agent_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "mentor_tasks_sessionId_idx" ON "mentor_tasks"("sessionId");

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

-- AddForeignKey
ALTER TABLE "mentor_enrollments" ADD CONSTRAINT "mentor_enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "mentor_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_enrollments" ADD CONSTRAINT "mentor_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_lesson_sessions" ADD CONSTRAINT "mentor_lesson_sessions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "mentor_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_lesson_sessions" ADD CONSTRAINT "mentor_lesson_sessions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "mentor_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_agent_messages" ADD CONSTRAINT "mentor_agent_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mentor_lesson_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_tasks" ADD CONSTRAINT "mentor_tasks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mentor_lesson_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

