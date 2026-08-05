-- AlterTable
ALTER TABLE "bog_payments" ADD COLUMN "promoCodeId" TEXT;

-- AddForeignKey
ALTER TABLE "bog_payments" ADD CONSTRAINT "bog_payments_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
