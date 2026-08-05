-- AlterTable
ALTER TABLE "course_certificates" ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "firstDownloadedAt" TIMESTAMP(3);
