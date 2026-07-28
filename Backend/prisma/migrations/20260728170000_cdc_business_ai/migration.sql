-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#06b6d4',
    "systemPrompt" TEXT NOT NULL,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fallbackPhone" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "question" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_conversations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "visitorRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER,
    "discountAmount" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_businessId_idx" ON "agents"("businessId");

-- CreateIndex
CREATE INDEX "knowledge_documents_agentId_idx" ON "knowledge_documents"("agentId");

-- CreateIndex
CREATE INDEX "agent_conversations_agentId_idx" ON "agent_conversations"("agentId");

-- CreateIndex
CREATE INDEX "agent_conversations_visitorRef_idx" ON "agent_conversations"("visitorRef");

-- CreateIndex
CREATE INDEX "agent_messages_conversationId_idx" ON "agent_messages"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversations" ADD CONSTRAINT "agent_conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agent_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

