-- CreateEnum
CREATE TYPE "ChatRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "chat_requests" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "ChatRequestStatus" NOT NULL DEFAULT 'PENDING',
    "introMessage" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_flags" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "attemptedContent" TEXT NOT NULL,
    "detectedReason" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_requests_recipientId_status_idx" ON "chat_requests"("recipientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chat_requests_senderId_recipientId_key" ON "chat_requests"("senderId", "recipientId");

-- CreateIndex
CREATE INDEX "chat_flags_senderId_idx" ON "chat_flags"("senderId");

-- CreateIndex
CREATE INDEX "chat_flags_createdAt_idx" ON "chat_flags"("createdAt");

-- AddForeignKey
ALTER TABLE "chat_requests" ADD CONSTRAINT "chat_requests_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_requests" ADD CONSTRAINT "chat_requests_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_flags" ADD CONSTRAINT "chat_flags_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_flags" ADD CONSTRAINT "chat_flags_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_flags" ADD CONSTRAINT "chat_flags_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

