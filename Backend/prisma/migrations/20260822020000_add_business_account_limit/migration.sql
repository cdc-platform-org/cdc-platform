-- CreateTable
CREATE TABLE "business_account_limits" (
    "id" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "maxAccounts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_account_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_account_limits_taxId_key" ON "business_account_limits"("taxId");
