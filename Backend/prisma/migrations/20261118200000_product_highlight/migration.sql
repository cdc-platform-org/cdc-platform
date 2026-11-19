-- Admin "highlight" flag for Digital Store products (BESTSELLER | POPULAR |
-- RECOMMENDED | NEW). Additive and nullable: existing rows stay unflagged.
ALTER TABLE "digital_products" ADD COLUMN "highlight" TEXT;
