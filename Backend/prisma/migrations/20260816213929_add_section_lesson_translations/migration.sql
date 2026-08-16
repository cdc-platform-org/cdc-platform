-- AlterTable
ALTER TABLE "course_sections" ADD COLUMN     "titleEn" TEXT;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "assignmentPromptEn" TEXT,
ADD COLUMN     "titleEn" TEXT;
