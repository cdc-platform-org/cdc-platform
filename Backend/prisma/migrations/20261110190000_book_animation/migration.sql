-- Paid "animated video" add-on for finished children's books.
-- Additive only: one enum value, one enum, one table.
ALTER TYPE "BogPaymentPurpose" ADD VALUE IF NOT EXISTS 'BOOK_ANIMATION';

CREATE TYPE "BookAnimationStatus" AS ENUM ('PAYMENT_PENDING', 'QUEUED', 'RENDERING', 'READY', 'FAILED');

CREATE TABLE "book_animations" (
    "id" TEXT NOT NULL,
    "bookProjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "BookAnimationStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "paidVia" TEXT,
    "paidAt" TIMESTAMP(3),
    "videoKey" TEXT,
    "durationSec" DOUBLE PRECISION,
    "error" TEXT,
    "soraSecondsUsed" INTEGER NOT NULL DEFAULT 0,
    "soraPages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "renderMs" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "autoRetried" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_animations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "book_animations_bookProjectId_key" ON "book_animations"("bookProjectId");
CREATE INDEX "book_animations_status_idx" ON "book_animations"("status");

ALTER TABLE "book_animations" ADD CONSTRAINT "book_animations_bookProjectId_fkey" FOREIGN KEY ("bookProjectId") REFERENCES "book_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
