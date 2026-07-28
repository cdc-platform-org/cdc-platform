-- AlterEnum
ALTER TYPE "VacancyStatus" ADD VALUE 'draft';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "companyDescription" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "websiteUrl" TEXT;

