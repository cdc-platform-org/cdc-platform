-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProctoringEventType" ADD VALUE 'FULLSCREEN_EXIT';
ALTER TYPE "ProctoringEventType" ADD VALUE 'FACE_MISSING';
ALTER TYPE "ProctoringEventType" ADD VALUE 'MULTIPLE_FACES';
ALTER TYPE "ProctoringEventType" ADD VALUE 'LOOKING_AWAY';
ALTER TYPE "ProctoringEventType" ADD VALUE 'BACKGROUND_VOICE';
