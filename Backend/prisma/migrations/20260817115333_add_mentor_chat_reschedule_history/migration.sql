-- AlterTable
ALTER TABLE "mentorship_bookings" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE "mentor_booking_history" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedById" TEXT,
    "previousScheduledAt" TIMESTAMP(3),
    "newScheduledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_booking_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_chat_messages" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_chat_violations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptedContent" TEXT NOT NULL,
    "detectedReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_chat_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_booking_history_bookingId_idx" ON "mentor_booking_history"("bookingId");

-- CreateIndex
CREATE INDEX "mentor_chat_messages_bookingId_idx" ON "mentor_chat_messages"("bookingId");

-- CreateIndex
CREATE INDEX "mentor_chat_violations_userId_idx" ON "mentor_chat_violations"("userId");

-- AddForeignKey
ALTER TABLE "mentor_booking_history" ADD CONSTRAINT "mentor_booking_history_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "mentorship_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_booking_history" ADD CONSTRAINT "mentor_booking_history_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_chat_messages" ADD CONSTRAINT "mentor_chat_messages_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "mentorship_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_chat_messages" ADD CONSTRAINT "mentor_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_chat_messages" ADD CONSTRAINT "mentor_chat_messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_chat_violations" ADD CONSTRAINT "mentor_chat_violations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "mentorship_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_chat_violations" ADD CONSTRAINT "mentor_chat_violations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
