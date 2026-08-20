-- CreateEnum
CREATE TYPE "GrantEligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "LaunchKitTargetType" AS ENUM ('DIGITAL_PRODUCT', 'COURSE');

-- AlterTable
ALTER TABLE "ai_automation_settings" ADD COLUMN     "grantScoutAutoArchiveIneligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "grantScoutNotifyOnMatch" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "grant_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "listingUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScanAt" TIMESTAMP(3),
    "lastScanStatus" TEXT,
    "lastScanError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grant_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grant_opportunities" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "summary" TEXT NOT NULL,
    "organization" TEXT,
    "deadline" TIMESTAMP(3),
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "budgetCurrency" TEXT,
    "georgiaEligible" BOOLEAN,
    "georgiaEligibleReason" TEXT NOT NULL,
    "scopeMatch" BOOLEAN,
    "scopeMatchReason" TEXT NOT NULL,
    "eligibilityStatus" "GrantEligibilityStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedReason" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grant_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_kits" (
    "id" TEXT NOT NULL,
    "targetType" "LaunchKitTargetType" NOT NULL,
    "productId" TEXT,
    "courseId" TEXT,
    "socialPosts" JSONB NOT NULL,
    "linkedinPost" TEXT NOT NULL,
    "salesEmailSubject" TEXT NOT NULL,
    "salesEmailBody" TEXT NOT NULL,
    "audienceProfile" JSONB NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'ka',
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launch_kits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grant_opportunities_eligibilityStatus_isArchived_deadline_idx" ON "grant_opportunities"("eligibilityStatus", "isArchived", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "grant_opportunities_sourceId_sourceUrl_key" ON "grant_opportunities"("sourceId", "sourceUrl");

-- CreateIndex
CREATE INDEX "launch_kits_productId_idx" ON "launch_kits"("productId");

-- CreateIndex
CREATE INDEX "launch_kits_courseId_idx" ON "launch_kits"("courseId");

-- AddForeignKey
ALTER TABLE "grant_opportunities" ADD CONSTRAINT "grant_opportunities_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "grant_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grant_opportunities" ADD CONSTRAINT "grant_opportunities_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_kits" ADD CONSTRAINT "launch_kits_productId_fkey" FOREIGN KEY ("productId") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_kits" ADD CONSTRAINT "launch_kits_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_kits" ADD CONSTRAINT "launch_kits_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

