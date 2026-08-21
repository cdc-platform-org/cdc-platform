-- AlterTable
ALTER TABLE "freelancer_skill_exam_attempts" ADD COLUMN     "categories" "JobCategory"[] DEFAULT ARRAY[]::"JobCategory"[],
ADD COLUMN     "customProfession" TEXT;
