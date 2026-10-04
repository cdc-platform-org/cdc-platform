-- CreateTable
CREATE TABLE "user_tutor_beginner_progress" (
    "userId" TEXT NOT NULL,
    "learnerDisplayName" TEXT,
    "currentStageId" TEXT NOT NULL DEFAULT 'greetings',
    "currentBlockIndex" INTEGER NOT NULL DEFAULT 0,
    "masteredConceptIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tutor_beginner_progress_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_tutor_beginner_progress" ADD CONSTRAINT "user_tutor_beginner_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
