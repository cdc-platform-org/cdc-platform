-- Marketing planner (stage 1): AI-written weekly FB/IG content calendar.
CREATE TABLE "MarketingPlannerSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "facebookPerWeek" INTEGER NOT NULL DEFAULT 3,
    "instagramPerWeek" INTEGER NOT NULL DEFAULT 3,
    "postHourTbilisi" INTEGER NOT NULL DEFAULT 19,
    "brandNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingPlannerSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingPost" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "productId" TEXT,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "angle" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL,
    "originalCaption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingPost_weekStart_idx" ON "MarketingPost"("weekStart");
CREATE INDEX "MarketingPost_status_scheduledAt_idx" ON "MarketingPost"("status", "scheduledAt");
CREATE INDEX "MarketingPost_productId_idx" ON "MarketingPost"("productId");

ALTER TABLE "MarketingPost" ADD CONSTRAINT "MarketingPost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "digital_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
