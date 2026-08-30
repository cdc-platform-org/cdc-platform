-- CreateEnum
CREATE TYPE "TeacherQuizQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'FREE_TEXT');

-- CreateTable
CREATE TABLE "teacher_quizzes" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_quiz_questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "TeacherQuizQuestionType" NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT NOT NULL,

    CONSTRAINT "teacher_quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_quiz_submissions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_quiz_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_quizzes_shareToken_key" ON "teacher_quizzes"("shareToken");

-- CreateIndex
CREATE INDEX "teacher_quizzes_teacherId_idx" ON "teacher_quizzes"("teacherId");

-- CreateIndex
CREATE INDEX "teacher_quiz_questions_quizId_idx" ON "teacher_quiz_questions"("quizId");

-- CreateIndex
CREATE INDEX "teacher_quiz_submissions_quizId_idx" ON "teacher_quiz_submissions"("quizId");

-- AddForeignKey
ALTER TABLE "teacher_quizzes" ADD CONSTRAINT "teacher_quizzes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_quiz_questions" ADD CONSTRAINT "teacher_quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "teacher_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_quiz_submissions" ADD CONSTRAINT "teacher_quiz_submissions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "teacher_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
