-- DropIndex
DROP INDEX "mentor_availability_exceptions_mentorId_date_key";

-- DropIndex
DROP INDEX "mentor_availability_exceptions_mentorId_idx";

-- AlterTable
ALTER TABLE "mentor_availability_exceptions" ADD COLUMN     "endMinute" INTEGER,
ADD COLUMN     "startMinute" INTEGER;

-- CreateIndex
CREATE INDEX "mentor_availability_exceptions_mentorId_date_idx" ON "mentor_availability_exceptions"("mentorId", "date");
