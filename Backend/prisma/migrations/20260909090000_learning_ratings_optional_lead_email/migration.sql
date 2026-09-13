-- Keep historical lead names and email values; new callback leads need no email.
ALTER TABLE "live_training_leads" ALTER COLUMN "email" DROP NOT NULL;

CREATE TABLE "course_ratings" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "course_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "course_ratings_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "live_training_ratings" (
    "id" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "live_training_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "live_training_ratings_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "course_ratings_userId_courseId_key" ON "course_ratings"("userId", "courseId");
CREATE INDEX "course_ratings_courseId_createdAt_idx" ON "course_ratings"("courseId", "createdAt");
CREATE UNIQUE INDEX "live_training_ratings_userId_liveTrainingId_key" ON "live_training_ratings"("userId", "liveTrainingId");
CREATE INDEX "live_training_ratings_liveTrainingId_createdAt_idx" ON "live_training_ratings"("liveTrainingId", "createdAt");

ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_training_ratings" ADD CONSTRAINT "live_training_ratings_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_training_ratings" ADD CONSTRAINT "live_training_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
