-- CreateTable
CREATE TABLE "mentor_availability_rules" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorship_bookings" (
    "id" TEXT NOT NULL,
    "bogPaymentId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "studentPhone" TEXT NOT NULL,
    "consultationDescription" TEXT,
    "googleEventId" TEXT,
    "googleMeetLink" TEXT,
    "calendarSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentorship_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_availability_rules_mentorId_idx" ON "mentor_availability_rules"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_bookings_bogPaymentId_key" ON "mentorship_bookings"("bogPaymentId");

-- CreateIndex
CREATE INDEX "mentorship_bookings_mentorId_idx" ON "mentorship_bookings"("mentorId");

-- CreateIndex
CREATE INDEX "mentorship_bookings_studentId_idx" ON "mentorship_bookings"("studentId");

-- AddForeignKey
ALTER TABLE "mentor_availability_rules" ADD CONSTRAINT "mentor_availability_rules_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_bookings" ADD CONSTRAINT "mentorship_bookings_bogPaymentId_fkey" FOREIGN KEY ("bogPaymentId") REFERENCES "bog_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_bookings" ADD CONSTRAINT "mentorship_bookings_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_bookings" ADD CONSTRAINT "mentorship_bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
