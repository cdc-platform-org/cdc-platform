-- CreateTable
CREATE TABLE "product_templates" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_designs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_templates_productId_key" ON "product_templates"("productId");

-- CreateIndex
CREATE INDEX "user_designs_userId_updatedAt_idx" ON "user_designs"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "user_designs_productId_idx" ON "user_designs"("productId");

-- AddForeignKey
ALTER TABLE "product_templates" ADD CONSTRAINT "product_templates_productId_fkey" FOREIGN KEY ("productId") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_designs" ADD CONSTRAINT "user_designs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_designs" ADD CONSTRAINT "user_designs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

