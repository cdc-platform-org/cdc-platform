/*
  Warnings:

  - You are about to drop the `moderation_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "moderation_settings";

-- CreateTable
CREATE TABLE "ai_automation_settings" (
    "id" TEXT NOT NULL,
    "autoApproveScoreThreshold" INTEGER NOT NULL DEFAULT 85,
    "autoApproveConfidenceThreshold" INTEGER NOT NULL DEFAULT 85,
    "blogAutoPublish" BOOLEAN NOT NULL DEFAULT false,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_automation_settings_pkey" PRIMARY KEY ("id")
);
