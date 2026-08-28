-- CreateEnum
CREATE TYPE "LiveTrainingEnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- AlterTable
ALTER TABLE "live_trainings" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "live_training_enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "status" "LiveTrainingEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_training_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_training_enrollments_liveTrainingId_idx" ON "live_training_enrollments"("liveTrainingId");

-- CreateIndex
CREATE UNIQUE INDEX "live_training_enrollments_userId_liveTrainingId_key" ON "live_training_enrollments"("userId", "liveTrainingId");

-- AddForeignKey
ALTER TABLE "live_training_enrollments" ADD CONSTRAINT "live_training_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_enrollments" ADD CONSTRAINT "live_training_enrollments_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
