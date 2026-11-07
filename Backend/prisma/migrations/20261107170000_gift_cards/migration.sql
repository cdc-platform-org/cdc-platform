-- Gift cards: a buyer pays via BOG for a card worth N GEL; on payment a
-- single promo code (promo_codes.isGiftCard) holding the balance is minted
-- and emailed to the recipient. Purely additive: new enum value, new enum,
-- new table, two new columns with defaults. No existing row changes.

-- AlterEnum
ALTER TYPE "BogPaymentPurpose" ADD VALUE 'GIFT_CARD';

-- CreateEnum
CREATE TYPE "GiftCardStatus" AS ENUM ('PENDING_PAYMENT', 'SCHEDULED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "promo_codes" ADD COLUMN "isGiftCard" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "bog_payments" ADD COLUMN "giftCardAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "purchaserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "senderName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "message" TEXT,
    "design" TEXT NOT NULL DEFAULT 'classic',
    "deliverAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "suggestedItem" TEXT,
    "suggestedUrl" TEXT,
    "promoCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_promoCodeId_key" ON "gift_cards"("promoCodeId");

-- CreateIndex
CREATE INDEX "gift_cards_purchaserId_idx" ON "gift_cards"("purchaserId");

-- CreateIndex
CREATE INDEX "gift_cards_status_deliverAt_idx" ON "gift_cards"("status", "deliverAt");

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
