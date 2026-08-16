-- CreateTable
CREATE TABLE "course_discussion_posts" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_discussion_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_discussion_posts_courseId_idx" ON "course_discussion_posts"("courseId");

-- CreateIndex
CREATE INDEX "course_discussion_posts_parentId_idx" ON "course_discussion_posts"("parentId");

-- AddForeignKey
ALTER TABLE "course_discussion_posts" ADD CONSTRAINT "course_discussion_posts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_discussion_posts" ADD CONSTRAINT "course_discussion_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_discussion_posts" ADD CONSTRAINT "course_discussion_posts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "course_discussion_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
