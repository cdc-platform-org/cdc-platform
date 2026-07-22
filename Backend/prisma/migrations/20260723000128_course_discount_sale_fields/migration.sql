-- Preserve existing price data via rename instead of drop+add.
ALTER TABLE "courses" RENAME COLUMN "price" TO "originalPrice";
ALTER TABLE "courses" ADD COLUMN "discountPercent" INTEGER;
ALTER TABLE "courses" ADD COLUMN "discountEndDate" TIMESTAMP(3);
ALTER TABLE "courses" ADD COLUMN "isOnSale" BOOLEAN NOT NULL DEFAULT false;
