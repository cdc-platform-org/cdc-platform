-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EducatorGenerationType" ADD VALUE 'SEN';
ALTER TYPE "EducatorGenerationType" ADD VALUE 'LESSON_PLAN';
ALTER TYPE "EducatorGenerationType" ADD VALUE 'BUREAUCRACY';
ALTER TYPE "EducatorGenerationType" ADD VALUE 'PARENT_REPORT';
