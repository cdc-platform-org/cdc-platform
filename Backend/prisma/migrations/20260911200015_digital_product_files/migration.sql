-- CreateTable
CREATE TABLE "digital_product_files" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_product_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digital_product_files_productId_sortOrder_idx" ON "digital_product_files"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "digital_product_files" ADD CONSTRAINT "digital_product_files_productId_fkey" FOREIGN KEY ("productId") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
