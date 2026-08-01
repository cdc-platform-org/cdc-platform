-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('ui_ux_design', 'web_development', 'graphic_design', 'digital_marketing', 'other');

-- AlterTable
ALTER TABLE "gigs" ADD COLUMN     "category" "JobCategory";

-- AlterTable
ALTER TABLE "vacancies" ADD COLUMN     "category" "JobCategory";
