-- AlterTable
-- Nullable first — existing rows have no slug yet, so a straight NOT NULL
-- add would fail on any pre-existing post. Backfilled below from the row's
-- own id (guaranteed unique, no need to slugify existing Georgian titles
-- in raw SQL), then locked to NOT NULL once every row has a value.
ALTER TABLE "blog_posts" ADD COLUMN     "slug" TEXT;
UPDATE "blog_posts" SET "slug" = 'post-' || substr("id", 1, 8) WHERE "slug" IS NULL;
ALTER TABLE "blog_posts" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "blog_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "success_stories" (
    "id" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "roleTitle" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "testimonial" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "success_stories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_comments_postId_idx" ON "blog_comments"("postId");

-- CreateIndex
CREATE INDEX "blog_comments_parentId_idx" ON "blog_comments"("parentId");

-- CreateIndex
CREATE INDEX "success_stories_isFeatured_idx" ON "success_stories"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "blog_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

