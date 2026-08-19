-- CreateEnum
CREATE TYPE "LiveTrainingLeadStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'SCHEDULED', 'DECLINED');

-- CreateTable
CREATE TABLE "live_trainings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "category" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "price" INTEGER,
    "thumbnailUrl" TEXT,
    "minCapacity" INTEGER NOT NULL DEFAULT 0,
    "maxCapacity" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "convertedToCourseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_training_leads" (
    "id" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "LiveTrainingLeadStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_training_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_trainings_convertedToCourseId_key" ON "live_trainings"("convertedToCourseId");

-- CreateIndex
CREATE INDEX "live_trainings_published_idx" ON "live_trainings"("published");

-- CreateIndex
CREATE INDEX "live_training_leads_liveTrainingId_idx" ON "live_training_leads"("liveTrainingId");

-- CreateIndex
CREATE INDEX "live_training_leads_status_idx" ON "live_training_leads"("status");

-- AddForeignKey
ALTER TABLE "live_trainings" ADD CONSTRAINT "live_trainings_convertedToCourseId_fkey" FOREIGN KEY ("convertedToCourseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_leads" ADD CONSTRAINT "live_training_leads_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
