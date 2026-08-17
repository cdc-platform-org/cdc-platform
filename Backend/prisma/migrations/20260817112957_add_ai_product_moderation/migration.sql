-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN     "aiReviewScore" INTEGER,
ADD COLUMN     "aiReviewConfidence" INTEGER,
ADD COLUMN     "aiReviewReasoning" TEXT,
ADD COLUMN     "aiReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "moderation_settings" (
    "id" TEXT NOT NULL,
    "autoApproveScoreThreshold" INTEGER NOT NULL DEFAULT 85,
    "autoApproveConfidenceThreshold" INTEGER NOT NULL DEFAULT 85,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_settings_pkey" PRIMARY KEY ("id")
);
