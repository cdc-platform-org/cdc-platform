-- Legacy client-generated grades have no evidence or authenticated evaluator.
ALTER TABLE "course_readiness_records" ADD COLUMN "aiEvidenceHash" TEXT,
    ADD COLUMN "lecturerEvaluatedById" TEXT;

CREATE TABLE "live_classroom_recordings" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recordingUrl" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedToCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "live_classroom_recordings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "live_classroom_recordings_trainingId_createdAt_idx" ON "live_classroom_recordings"("trainingId", "createdAt");
ALTER TABLE "live_classroom_recordings" ADD CONSTRAINT "live_classroom_recordings_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
