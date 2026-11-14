-- AlterEnum
ALTER TYPE "BogPaymentPurpose" ADD VALUE 'COLORING_CREDITS';

-- CreateEnum
CREATE TYPE "ColoringPageStatus" AS ENUM ('GENERATING', 'READY', 'BLOCKED', 'FAILED');

-- CreateTable
CREATE TABLE "coloring_accounts" (
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "freeUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coloring_accounts_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "coloring_pages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT,
    "status" "ColoringPageStatus" NOT NULL DEFAULT 'GENERATING',
    "paidWith" TEXT NOT NULL,
    "blobName" TEXT,
    "blockedReason" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coloring_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coloring_credit_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amountTetri" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "coloring_credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coloring_pages_userId_createdAt_idx" ON "coloring_pages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "coloring_credit_purchases_userId_createdAt_idx" ON "coloring_credit_purchases"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "coloring_accounts" ADD CONSTRAINT "coloring_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_pages" ADD CONSTRAINT "coloring_pages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_credit_purchases" ADD CONSTRAINT "coloring_credit_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
