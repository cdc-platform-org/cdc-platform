ALTER TABLE "iako_usage_grants"
ADD COLUMN "processingToken" TEXT,
ADD COLUMN "processingExpiresAt" TIMESTAMP(3);

ALTER TABLE "iako_request_logs" ADD COLUMN "requestHash" TEXT, ADD COLUMN "counted" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "outOfScope" BOOLEAN NOT NULL DEFAULT false;
