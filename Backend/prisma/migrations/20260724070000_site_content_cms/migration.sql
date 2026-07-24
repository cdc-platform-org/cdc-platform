-- CreateTable
CREATE TABLE "site_content" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_content_page_key" ON "site_content"("page");

-- AddForeignKey
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

