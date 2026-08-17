-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN     "previewImages" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "studio_case_studies" ADD COLUMN     "videoUrl" TEXT;
