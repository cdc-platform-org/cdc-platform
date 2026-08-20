-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN     "previewVideoUrl" TEXT;

-- AlterTable: replace single imageUrl with a capped-at-3 images array,
-- preserving any existing photo instead of dropping it outright.
ALTER TABLE "product_reviews" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "product_reviews" SET "images" = ARRAY["imageUrl"]::TEXT[] WHERE "imageUrl" IS NOT NULL;

ALTER TABLE "product_reviews" DROP COLUMN "imageUrl";
