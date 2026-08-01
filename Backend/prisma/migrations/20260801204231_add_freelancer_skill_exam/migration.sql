-- CreateTable
CREATE TABLE "freelancer_skill_exam_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "JobCategory" NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "freelancer_skill_exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "freelancer_skill_exam_attempts_userId_idx" ON "freelancer_skill_exam_attempts"("userId");

-- AddForeignKey
ALTER TABLE "freelancer_skill_exam_attempts" ADD CONSTRAINT "freelancer_skill_exam_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
