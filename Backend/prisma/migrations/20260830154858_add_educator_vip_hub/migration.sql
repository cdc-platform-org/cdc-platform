-- CreateEnum
CREATE TYPE "EducatorGenerationType" AS ENUM ('TEST_GENERATOR', 'RUBRIC', 'GRADING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentSessionId" TEXT,
ADD COLUMN     "educatorVipActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "educatorVipTrialEndDate" TIMESTAMP(3),
ADD COLUMN     "educatorVipTrialStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "educator_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EducatorGenerationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educator_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "educator_generations_userId_type_createdAt_idx" ON "educator_generations"("userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "educator_generations" ADD CONSTRAINT "educator_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
