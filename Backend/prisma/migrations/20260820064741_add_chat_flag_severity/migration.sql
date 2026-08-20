-- CreateEnum
CREATE TYPE "ChatFlagSeverity" AS ENUM ('MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "chat_flags" ADD COLUMN     "severity" "ChatFlagSeverity" NOT NULL DEFAULT 'MEDIUM';

