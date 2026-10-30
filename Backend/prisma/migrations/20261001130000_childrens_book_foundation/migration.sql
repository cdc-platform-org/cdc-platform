-- CDC Custom AI Children's Book — Batch A: schema + state foundation only.
-- No data migration, no changes to any existing table. CHECK constraints
-- below follow this repo's existing precedent (see
-- 20260909090000_learning_ratings_optional_lead_email/migration.sql's
-- "course_ratings_rating_check") for hand-added CHECK constraints not
-- expressible in schema.prisma itself.

-- CreateEnum
CREATE TYPE "BookLanguage" AS ENUM ('KA', 'EN');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'STORY_PLAN_READY', 'CHARACTER_PREVIEW_GENERATING', 'CHARACTER_PREVIEW_READY', 'CHARACTER_APPROVED', 'PAYMENT_PENDING', 'PAID', 'FINAL_GENERATING', 'FINAL_QA', 'FINAL_READY', 'REVISION_REQUESTED', 'REVISION_GENERATING', 'REVISION_QA', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BookPdfStatus" AS ENUM ('NONE', 'GENERATING', 'CURRENT', 'STALE', 'FAILED');

-- CreateEnum
CREATE TYPE "BookImageGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BookQaStatus" AS ENUM ('PASS', 'PARTIAL', 'FAIL');

-- CreateEnum
CREATE TYPE "BookGenerationOperationType" AS ENUM ('STORY_PLAN', 'CHARACTER_PREVIEW', 'FINAL_PAGE', 'REVISION');

-- CreateTable
-- priceGel/pageCount/revisionLimit CHECKs pin today's single-tier product
-- constants at the DB level too, not just in bookStateService.ts — this is
-- intentional friction: changing any of them later requires a migration,
-- matching "No client-configurable price/pageCount/revisionLimit."
CREATE TABLE "book_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" "BookLanguage" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfStatus" "BookPdfStatus" NOT NULL DEFAULT 'NONE',
    "illustrationStyle" TEXT,
    "priceGel" INTEGER NOT NULL DEFAULT 1500,
    "pageCount" INTEGER NOT NULL DEFAULT 10,
    "revisionLimit" INTEGER NOT NULL DEFAULT 1,
    "revisionUsed" BOOLEAN NOT NULL DEFAULT false,
    "characterConfig" JSONB,
    "characterBible" JSONB,
    "characterBibleVersion" INTEGER,
    "styleBible" JSONB,
    "storyPlan" JSONB,
    "paymentProvider" TEXT,
    "finalPdfBlobRef" TEXT,
    "pdfVersion" INTEGER NOT NULL DEFAULT 0,
    "previewQuality" TEXT NOT NULL DEFAULT 'low',
    "finalQuality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "book_projects_priceGel_check" CHECK ("priceGel" = 1500),
    CONSTRAINT "book_projects_pageCount_check" CHECK ("pageCount" = 10),
    CONSTRAINT "book_projects_revisionLimit_check" CHECK ("revisionLimit" = 1)
);

-- CreateTable
-- pageNumber/revisionVersion CHECKs mirror the pageNumber-range and
-- 0/1-revision-version invariants bookStateService.ts also enforces at the
-- application layer (defense in depth, same reasoning as the existing
-- "rating BETWEEN 1 AND 5" precedent).
CREATE TABLE "book_pages" (
    "id" TEXT NOT NULL,
    "bookProjectId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "sceneSpec" JSONB,
    "storyText" TEXT,
    "imageGenerationStatus" "BookImageGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedEventId" TEXT,
    "revisionVersion" INTEGER NOT NULL DEFAULT 0,
    "qaStatus" "BookQaStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_pages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "book_pages_pageNumber_check" CHECK ("pageNumber" BETWEEN 1 AND 10),
    CONSTRAINT "book_pages_revisionVersion_check" CHECK ("revisionVersion" IN (0, 1))
);

-- CreateTable
-- attemptNumber CHECK is a cheap sanity bound; the real
-- duplicate-vs-legitimate-retry guarantee is the
-- (logicalOperationKey, attemptNumber) unique index below, not this check.
CREATE TABLE "book_generation_events" (
    "id" TEXT NOT NULL,
    "bookProjectId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "operationType" "BookGenerationOperationType" NOT NULL,
    "logicalOperationKey" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "revisionVersion" INTEGER NOT NULL DEFAULT 0,
    "deployment" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "requestedSize" TEXT NOT NULL,
    "requestId" TEXT,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorClassification" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "book_generation_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "book_generation_events_attemptNumber_check" CHECK ("attemptNumber" >= 1)
);

-- CreateIndex
CREATE INDEX "book_projects_userId_idx" ON "book_projects"("userId");

-- CreateIndex
CREATE INDEX "book_projects_status_idx" ON "book_projects"("status");

-- CreateIndex
CREATE INDEX "book_projects_pdfStatus_idx" ON "book_projects"("pdfStatus");

-- CreateIndex
CREATE UNIQUE INDEX "book_pages_acceptedEventId_key" ON "book_pages"("acceptedEventId");

-- CreateIndex
CREATE INDEX "book_pages_imageGenerationStatus_idx" ON "book_pages"("imageGenerationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "book_pages_bookProjectId_pageNumber_key" ON "book_pages"("bookProjectId", "pageNumber");

-- CreateIndex
CREATE INDEX "book_generation_events_bookProjectId_idx" ON "book_generation_events"("bookProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "book_generation_events_logicalOperationKey_attemptNumber_key" ON "book_generation_events"("logicalOperationKey", "attemptNumber");

-- AddForeignKey
ALTER TABLE "book_projects" ADD CONSTRAINT "book_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_bookProjectId_fkey" FOREIGN KEY ("bookProjectId") REFERENCES "book_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_pages" ADD CONSTRAINT "book_pages_acceptedEventId_fkey" FOREIGN KEY ("acceptedEventId") REFERENCES "book_generation_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_generation_events" ADD CONSTRAINT "book_generation_events_bookProjectId_fkey" FOREIGN KEY ("bookProjectId") REFERENCES "book_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
