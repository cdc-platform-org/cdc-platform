-- AlterEnum
ALTER TYPE "WalletEntryType" ADD VALUE 'PRODUCT_SALE_CREDIT';

-- AlterTable
ALTER TABLE "product_purchases" ADD COLUMN "commissionRate" DOUBLE PRECISION;
ALTER TABLE "product_purchases" ADD COLUMN "commissionAmount" INTEGER;
ALTER TABLE "product_purchases" ADD COLUMN "netAmount" INTEGER;
