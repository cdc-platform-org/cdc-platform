-- Admin-issued (free) gift cards. Purely additive: two columns with
-- defaults on gift_cards; existing rows become complimentary=false, PERSON.

-- AlterTable
ALTER TABLE "gift_cards" ADD COLUMN "complimentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recipientType" TEXT NOT NULL DEFAULT 'PERSON';
