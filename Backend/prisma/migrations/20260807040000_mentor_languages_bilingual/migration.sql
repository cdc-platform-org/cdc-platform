-- AlterTable
ALTER TABLE "users" ADD COLUMN "bioEn" TEXT;
ALTER TABLE "users" ADD COLUMN "mentorTitleEn" TEXT;
ALTER TABLE "users" ADD COLUMN "mentorLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[];
