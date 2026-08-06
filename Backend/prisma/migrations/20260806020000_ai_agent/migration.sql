-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN "generatedByAgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "blog_posts" ADD COLUMN "agentPromptContext" TEXT;

-- CreateTable
CREATE TABLE "ai_generation_logs" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputContext" JSONB,
    "outputSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_generation_logs_module_idx" ON "ai_generation_logs"("module");

-- CreateIndex
CREATE INDEX "ai_generation_logs_createdAt_idx" ON "ai_generation_logs"("createdAt");
