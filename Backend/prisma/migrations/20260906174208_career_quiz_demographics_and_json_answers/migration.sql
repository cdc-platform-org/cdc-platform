/*
  Warnings:

  - You are about to drop the column `experience` on the `career_quiz_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `interests` on the `career_quiz_submissions` table. All the data in the column will be lost.
  - You are about to drop the column `mainGoal` on the `career_quiz_submissions` table. All the data in the column will be lost.
  - Added the required column `answers` to the `career_quiz_submissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `career_quiz_submissions` table without a default value. This is not possible if the table is not empty.
  - Made the column `age` on table `career_quiz_submissions` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "CareerQuizGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "career_quiz_submissions" DROP COLUMN "experience",
DROP COLUMN "interests",
DROP COLUMN "mainGoal",
ADD COLUMN     "answers" JSONB NOT NULL,
ADD COLUMN     "gender" "CareerQuizGender" NOT NULL,
ALTER COLUMN "age" SET NOT NULL;
