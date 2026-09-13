-- CreateTable
CREATE TABLE "trainer_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_training_trainer_assignments" (
    "id" TEXT NOT NULL,
    "trainerProfileId" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_training_trainer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainer_profiles_userId_key" ON "trainer_profiles"("userId");

-- CreateIndex
CREATE INDEX "live_training_trainer_assignments_trainerProfileId_idx" ON "live_training_trainer_assignments"("trainerProfileId");

-- CreateIndex
CREATE INDEX "live_training_trainer_assignments_liveTrainingId_idx" ON "live_training_trainer_assignments"("liveTrainingId");

-- CreateIndex
CREATE UNIQUE INDEX "live_training_trainer_assignments_trainerProfileId_liveTrai_key" ON "live_training_trainer_assignments"("trainerProfileId", "liveTrainingId");

-- AddForeignKey
ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_trainer_assignments" ADD CONSTRAINT "live_training_trainer_assignments_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "trainer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_trainer_assignments" ADD CONSTRAINT "live_training_trainer_assignments_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
