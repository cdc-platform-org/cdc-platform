-- AlterTable
ALTER TABLE "users" ADD COLUMN "mentorTitle" TEXT,
ADD COLUMN "mentorHourlyRate" INTEGER,
ADD COLUMN "mentorSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];
