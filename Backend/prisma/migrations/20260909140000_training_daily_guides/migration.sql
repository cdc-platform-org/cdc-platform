-- CreateEnum
CREATE TYPE "GuideVisibility" AS ENUM ('TODAY_ONLY', 'CURRENT_AND_PREVIOUS', 'ALL_DAYS');

-- CreateTable
CREATE TABLE "training_guide_settings" (
    "liveTrainingId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Tbilisi',
    "startDate" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedDayNumber" INTEGER,
    "currentDayOverride" INTEGER,
    "visibility" "GuideVisibility" NOT NULL DEFAULT 'CURRENT_AND_PREVIOUS',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_guide_settings_pkey" PRIMARY KEY ("liveTrainingId")
);

-- CreateTable
CREATE TABLE "training_days" (
    "id" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "scheduledDate" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sections" JSONB NOT NULL,
    "sourcePages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_day_progress" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_day_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_guide_sources" (
    "id" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "dayNumber" INTEGER,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_guide_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_days_liveTrainingId_dayNumber_key" ON "training_days"("liveTrainingId", "dayNumber");

-- CreateIndex
CREATE INDEX "training_day_progress_dayId_idx" ON "training_day_progress"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "training_day_progress_userId_dayId_itemId_key" ON "training_day_progress"("userId", "dayId", "itemId");

-- CreateIndex
CREATE INDEX "training_guide_sources_liveTrainingId_dayNumber_idx" ON "training_guide_sources"("liveTrainingId", "dayNumber");

-- AddForeignKey
ALTER TABLE "training_guide_settings" ADD CONSTRAINT "training_guide_settings_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_days" ADD CONSTRAINT "training_days_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_day_progress" ADD CONSTRAINT "training_day_progress_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "training_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_day_progress" ADD CONSTRAINT "training_day_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_guide_sources" ADD CONSTRAINT "training_guide_sources_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
