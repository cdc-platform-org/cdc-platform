-- Digital Store: lets an admin attach more than one downloadable file to a
-- product and see each file's original name. Purely additive — one nullable
-- column and one column with a constant default; no existing row's data is
-- rewritten, and fileUrl stays the main file exactly as before.

-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN "fileName" TEXT,
ADD COLUMN "additionalFiles" JSONB NOT NULL DEFAULT '[]';
