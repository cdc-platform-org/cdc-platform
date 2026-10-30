-- Children's Book — Audio Story add-on + mock narration persistence.

CREATE TYPE "BookNarrationStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

ALTER TABLE "book_projects"
  ADD COLUMN "audioAddOnPurchased" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "audioPriceGel" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalPriceGel" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "book_narration_artifacts" (
    "id" TEXT NOT NULL,
    "bookProjectId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "revisionVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "BookNarrationStatus" NOT NULL DEFAULT 'PENDING',
    "language" "BookLanguage" NOT NULL,
    "mimeType" TEXT,
    "artifactKey" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "book_narration_artifacts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "book_narration_artifacts_bookProjectId_fkey"
      FOREIGN KEY ("bookProjectId") REFERENCES "book_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "book_narration_artifacts_pageNumber_check" CHECK ("pageNumber" >= 1 AND "pageNumber" <= 20)
);

CREATE UNIQUE INDEX "book_narration_artifacts_bookProjectId_pageNumber_revisionVersion_key"
  ON "book_narration_artifacts" ("bookProjectId", "pageNumber", "revisionVersion");

CREATE INDEX "book_narration_artifacts_bookProjectId_status_idx"
  ON "book_narration_artifacts" ("bookProjectId", "status");

UPDATE "book_projects"
SET "totalPriceGel" = "priceGel" + "audioPriceGel";
