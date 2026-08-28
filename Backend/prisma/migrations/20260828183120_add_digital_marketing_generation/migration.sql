-- CreateTable
CREATE TABLE "digital_marketing_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_marketing_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digital_marketing_generations_userId_createdAt_idx" ON "digital_marketing_generations"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "digital_marketing_generations" ADD CONSTRAINT "digital_marketing_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
