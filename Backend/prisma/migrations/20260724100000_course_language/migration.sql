-- CreateEnum
CREATE TYPE "CourseLanguage" AS ENUM ('GEORGIAN', 'ENGLISH', 'BOTH');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "language" "CourseLanguage" NOT NULL DEFAULT 'GEORGIAN';

