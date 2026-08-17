-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STUB', 'BOG');

-- CreateEnum
CREATE TYPE "BillingProductType" AS ENUM ('AI_AGENT_SUITE');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('AI_AGENT_EXECUTION');

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'STUB',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_settings" (
    "id" TEXT NOT NULL,
    "baseFeeTetri" INTEGER NOT NULL DEFAULT 9900,
    "marginMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "trialDays" INTEGER NOT NULL DEFAULT 10,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productType" "BillingProductType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "baseFeeTetri" INTEGER NOT NULL,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethodId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "agentId" TEXT,
    "eventType" "UsageEventType" NOT NULL DEFAULT 'AI_AGENT_EXECUTION',
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "rawCostTetri" INTEGER NOT NULL DEFAULT 0,
    "billedCostTetri" INTEGER NOT NULL DEFAULT 0,
    "marginMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_subscriptions_businessId_idx" ON "billing_subscriptions"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_businessId_productType_referenceId_key" ON "billing_subscriptions"("businessId", "productType", "referenceId");

-- CreateIndex
CREATE INDEX "usage_records_subscriptionId_idx" ON "usage_records"("subscriptionId");

-- CreateIndex
CREATE INDEX "usage_records_agentId_idx" ON "usage_records"("agentId");

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
