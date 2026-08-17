-- CreateTable
CREATE TABLE "cyber_sentinel_waitlist_entries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cyber_sentinel_waitlist_entries_pkey" PRIMARY KEY ("id")
);
