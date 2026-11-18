-- Admin "highlight" flag for Digital Store products (BESTSELLER | POPULAR |
-- RECOMMENDED | NEW). Additive and nullable: existing rows stay unflagged.
ALTER TABLE "DigitalProduct" ADD COLUMN "highlight" TEXT;
