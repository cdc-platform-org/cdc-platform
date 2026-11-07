-- Admin refunds through BOG's refund API (services/bogRefundService.ts).
-- Purely additive: two new enum values, two new columns with safe defaults
-- on bog_payments, and a new bog_refunds history table. No existing row
-- changes meaning.

-- CreateEnum
CREATE TYPE "BogRefundStatus" AS ENUM ('REQUESTED', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "BogPaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'REFUND_CLAWBACK';

-- AlterTable
ALTER TABLE "bog_payments" ADD COLUMN     "refundedAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "bog_refunds" (
    "id" TEXT NOT NULL,
    "bogPaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "BogRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "recordOnly" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "accessRevoked" BOOLEAN NOT NULL DEFAULT false,
    "bogActionId" TEXT,
    "bogResponse" JSONB,
    "errorMessage" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bog_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bog_refunds_bogPaymentId_idx" ON "bog_refunds"("bogPaymentId");

-- AddForeignKey
ALTER TABLE "bog_refunds" ADD CONSTRAINT "bog_refunds_bogPaymentId_fkey" FOREIGN KEY ("bogPaymentId") REFERENCES "bog_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bog_refunds" ADD CONSTRAINT "bog_refunds_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
