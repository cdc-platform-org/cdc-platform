-- Weekly trend briefs for the product agent (services/productAgent/trends.ts).
CREATE TABLE "product_agent_trend_briefs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_agent_trend_briefs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "product_agent_trend_briefs_category_createdAt_idx" ON "product_agent_trend_briefs"("category", "createdAt");
