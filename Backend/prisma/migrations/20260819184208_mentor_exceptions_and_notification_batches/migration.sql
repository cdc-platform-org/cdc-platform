-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mentor_availability_exceptions" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_batches" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ADMIN_DIRECT',
    "targetUserId" TEXT,
    "targetRole" TEXT,
    "targetLabel" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "sentById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_availability_exceptions_mentorId_idx" ON "mentor_availability_exceptions"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_availability_exceptions_mentorId_date_key" ON "mentor_availability_exceptions"("mentorId", "date");

-- CreateIndex
CREATE INDEX "notification_batches_sentById_idx" ON "notification_batches"("sentById");

-- CreateIndex
CREATE INDEX "notifications_batchId_idx" ON "notifications"("batchId");

-- AddForeignKey
ALTER TABLE "mentor_availability_exceptions" ADD CONSTRAINT "mentor_availability_exceptions_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "notification_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_batches" ADD CONSTRAINT "notification_batches_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
