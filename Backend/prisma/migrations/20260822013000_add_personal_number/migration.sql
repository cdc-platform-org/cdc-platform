-- AlterTable
ALTER TABLE "users" ADD COLUMN     "personalNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_personalNumber_key" ON "users"("personalNumber");
