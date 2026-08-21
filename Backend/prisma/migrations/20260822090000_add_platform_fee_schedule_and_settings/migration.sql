-- CreateEnum
CREATE TYPE "PlatformFeeServiceType" AS ENUM ('GIG_UNVERIFIED', 'GIG_VERIFIED', 'MENTORSHIP', 'HR_SUPPORT', 'DIGITAL_PRODUCT');

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "dailyPostLimit" INTEGER NOT NULL DEFAULT 3,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_fee_schedule" (
    "id" TEXT NOT NULL,
    "serviceType" "PlatformFeeServiceType" NOT NULL,
    "commissionPercentage" DOUBLE PRECISION NOT NULL,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_fee_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_fee_schedule_serviceType_key" ON "platform_fee_schedule"("serviceType");

-- Seed the current live commission values so deploying this migration alone
-- (before any SuperAdmin visits /admin/commissions) doesn't change what any
-- of the 4 escrow/sale services charge — same defaults previously hardcoded
-- in escrowService.ts / mentorshipEscrowService.ts / hrSupportEscrowService.ts
-- / productSaleService.ts (see platformFeeScheduleService.ts's
-- FALLBACK_PERCENTAGE, which mirrors these same 5 values as a
-- belt-and-suspenders app-level fallback if a row is ever missing).
INSERT INTO "platform_fee_schedule" ("id", "serviceType", "commissionPercentage", "updatedAt") VALUES
    ('7e2d1a10-2b3c-4a4e-9c1a-1f6a2b3c4d01', 'GIG_UNVERIFIED', 25, CURRENT_TIMESTAMP),
    ('7e2d1a10-2b3c-4a4e-9c1a-1f6a2b3c4d02', 'GIG_VERIFIED', 20, CURRENT_TIMESTAMP),
    ('7e2d1a10-2b3c-4a4e-9c1a-1f6a2b3c4d03', 'MENTORSHIP', 20, CURRENT_TIMESTAMP),
    ('7e2d1a10-2b3c-4a4e-9c1a-1f6a2b3c4d04', 'HR_SUPPORT', 40, CURRENT_TIMESTAMP),
    ('7e2d1a10-2b3c-4a4e-9c1a-1f6a2b3c4d05', 'DIGITAL_PRODUCT', 20, CURRENT_TIMESTAMP);
