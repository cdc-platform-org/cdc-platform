-- AlterTable
ALTER TABLE "success_stories" ADD COLUMN     "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hiredBy" TEXT,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "roleTitleEn" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "storyContent" TEXT,
ADD COLUMN     "storyContentEn" TEXT,
ADD COLUMN     "testimonialEn" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "success_stories_slug_key" ON "success_stories"("slug");

