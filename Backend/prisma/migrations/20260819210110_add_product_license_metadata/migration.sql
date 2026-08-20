-- CreateEnum
CREATE TYPE "ProductLicenseType" AS ENUM ('PERSONAL_USE', 'COMMERCIAL_USE', 'EXTENDED_COMMERCIAL');

-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN     "licenseType" "ProductLicenseType" NOT NULL DEFAULT 'PERSONAL_USE';

-- AlterTable
ALTER TABLE "product_purchases" ADD COLUMN     "licenseType" "ProductLicenseType";

