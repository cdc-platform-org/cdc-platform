-- CreateEnum
CREATE TYPE "IakoAssignmentMode" AS ENUM ('TESTING', 'LIVE');

-- AlterTable
ALTER TABLE "iako_profile_assignments" ADD COLUMN     "mode" "IakoAssignmentMode" NOT NULL DEFAULT 'LIVE';
