-- AlterTable
ALTER TABLE "users" ADD COLUMN "githubId" TEXT;
ALTER TABLE "users" ADD COLUMN "facebookId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");
CREATE UNIQUE INDEX "users_facebookId_key" ON "users"("facebookId");
