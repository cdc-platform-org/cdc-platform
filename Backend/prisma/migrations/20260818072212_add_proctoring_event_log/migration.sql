-- CreateEnum
CREATE TYPE "ProctoringEventType" AS ENUM ('TAB_SWITCH', 'COPY_PASTE');

-- CreateTable
CREATE TABLE "proctoring_events" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "type" "ProctoringEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proctoring_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proctoring_events_submissionId_idx" ON "proctoring_events"("submissionId");

-- AddForeignKey
ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "exam_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
