-- CreateEnum
CREATE TYPE "StudioInquiryStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "studio_inquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "projectType" TEXT NOT NULL,
    "budgetRange" TEXT,
    "message" TEXT NOT NULL,
    "status" "StudioInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_inquiries_status_idx" ON "studio_inquiries"("status");

-- AddForeignKey
ALTER TABLE "studio_inquiries" ADD CONSTRAINT "studio_inquiries_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

