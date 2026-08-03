-- AlterTable
ALTER TABLE "digital_products" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "digital_products" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "digital_products" ADD COLUMN "submittedById" TEXT;

-- AddForeignKey
ALTER TABLE "digital_products" ADD CONSTRAINT "digital_products_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
