-- AlterEnum
ALTER TYPE "LiveTrainingEnrollmentStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "exam_sessions" ADD COLUMN     "liveTrainingId" TEXT;

-- AlterTable
ALTER TABLE "live_training_enrollments" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "exam_sessions_liveTrainingId_idx" ON "exam_sessions"("liveTrainingId");

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
