-- Product agent: AI-generated store products (see services/productAgent/).

ALTER TABLE "digital_products" ADD COLUMN "createdByAgent" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "digital_products_createdByAgent_createdAt_idx" ON "digital_products"("createdByAgent", "createdAt");

CREATE TABLE "product_agent_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyCounts" JSONB NOT NULL DEFAULT '{}',
    "imageQuality" TEXT NOT NULL DEFAULT 'high',
    "monthlyBudgetUsd" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "runHourUtc" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_agent_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_agent_runs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL,
    "theme" TEXT,
    "productId" TEXT,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "product_agent_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_agent_runs_category_startedAt_idx" ON "product_agent_runs"("category", "startedAt");
CREATE INDEX "product_agent_runs_startedAt_idx" ON "product_agent_runs"("startedAt");
ALTER TABLE "product_agent_runs" ADD CONSTRAINT "product_agent_runs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "digital_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "product_agent_assets" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_agent_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_agent_assets_kind_idx" ON "product_agent_assets"("kind");
