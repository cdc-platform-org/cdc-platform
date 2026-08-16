-- CreateEnum
CREATE TYPE "VerifiedSkillSource" AS ENUM ('AI_TEST', 'COURSE_COMPLETION');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "skillsTaught" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "freelancerSkills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "skill_test_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "mcqScore" DOUBLE PRECISION,
    "practicalScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "skill_test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_skills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "verifiedVia" "VerifiedSkillSource" NOT NULL,
    "score" DOUBLE PRECISION,
    "courseId" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_skills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_test_attempts_userId_idx" ON "skill_test_attempts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verified_skills_userId_skillName_key" ON "verified_skills"("userId", "skillName");

-- AddForeignKey
ALTER TABLE "skill_test_attempts" ADD CONSTRAINT "skill_test_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_skills" ADD CONSTRAINT "verified_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
