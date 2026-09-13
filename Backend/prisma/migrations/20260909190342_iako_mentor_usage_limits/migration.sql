/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `iako_messages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "iako_assistant_profiles" ADD COLUMN     "defaultAccessDays" INTEGER DEFAULT 10,
ADD COLUMN     "defaultDailyRequestLimit" INTEGER DEFAULT 30,
ADD COLUMN     "defaultHourlyRequestLimit" INTEGER DEFAULT 10,
ADD COLUMN     "defaultMaxScreenshotsPerMessage" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "defaultRequestLimit" INTEGER DEFAULT 200,
ADD COLUMN     "defaultScreenshotLimit" INTEGER DEFAULT 30,
ADD COLUMN     "mentorTagline" TEXT,
ADD COLUMN     "welcomeMessageEn" TEXT,
ADD COLUMN     "welcomeMessageKa" TEXT;

-- AlterTable
ALTER TABLE "iako_conversations" ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summaryUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "iako_messages" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "iako_usage_grants" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "IakoGrantResource" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "requestLimit" INTEGER,
    "dailyRequestLimit" INTEGER,
    "hourlyRequestLimit" INTEGER,
    "screenshotLimit" INTEGER,
    "maxScreenshotsPerMessage" INTEGER NOT NULL DEFAULT 3,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "usageResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iako_usage_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iako_request_logs" (
    "id" TEXT NOT NULL,
    "usageGrantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "screenshotCount" INTEGER NOT NULL DEFAULT 0,
    "resultMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iako_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iako_usage_grants_profileId_userId_resourceType_resourceId_key" ON "iako_usage_grants"("profileId", "userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "iako_request_logs_usageGrantId_createdAt_idx" ON "iako_request_logs"("usageGrantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "iako_request_logs_usageGrantId_idempotencyKey_key" ON "iako_request_logs"("usageGrantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "iako_usage_grants" ADD CONSTRAINT "iako_usage_grants_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "iako_assistant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_usage_grants" ADD CONSTRAINT "iako_usage_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_usage_grants" ADD CONSTRAINT "iako_usage_grants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_request_logs" ADD CONSTRAINT "iako_request_logs_usageGrantId_fkey" FOREIGN KEY ("usageGrantId") REFERENCES "iako_usage_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
