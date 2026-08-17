-- CreateTable
CREATE TABLE "cyber_sentinel_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "agentVersion" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cyber_sentinel_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cyber_sentinel_devices_userId_idx" ON "cyber_sentinel_devices"("userId");

-- AddForeignKey
ALTER TABLE "cyber_sentinel_devices" ADD CONSTRAINT "cyber_sentinel_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
