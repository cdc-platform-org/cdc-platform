-- CreateEnum
CREATE TYPE "SubtitlesStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN "subtitlesStatus" "SubtitlesStatus",
ADD COLUMN "subtitlesError" TEXT;
