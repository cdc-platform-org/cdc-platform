-- CreateEnum
CREATE TYPE "TeamMemberType" AS ENUM ('MANAGEMENT', 'TRAINER');

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "type" "TeamMemberType" NOT NULL DEFAULT 'MANAGEMENT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_case_studies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fullStory" TEXT,
    "coverImageUrl" TEXT,
    "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_members_type_active_idx" ON "team_members"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "studio_case_studies_slug_key" ON "studio_case_studies"("slug");

-- CreateIndex
CREATE INDEX "studio_case_studies_isFeatured_idx" ON "studio_case_studies"("isFeatured");
