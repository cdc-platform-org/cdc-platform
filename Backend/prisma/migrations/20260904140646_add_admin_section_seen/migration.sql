-- CreateTable
CREATE TABLE "admin_section_seen" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_section_seen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_section_seen_adminId_section_key" ON "admin_section_seen"("adminId", "section");

-- AddForeignKey
ALTER TABLE "admin_section_seen" ADD CONSTRAINT "admin_section_seen_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
