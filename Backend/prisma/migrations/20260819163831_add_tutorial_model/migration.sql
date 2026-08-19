-- CreateTable
CREATE TABLE "tutorials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "titleEn" TEXT,
    "descriptionEn" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutorials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutorials_category_idx" ON "tutorials"("category");

-- CreateIndex
CREATE INDEX "tutorials_publishedAt_idx" ON "tutorials"("publishedAt");
