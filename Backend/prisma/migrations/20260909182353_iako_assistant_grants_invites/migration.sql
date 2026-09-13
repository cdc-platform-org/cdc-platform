-- CreateEnum
CREATE TYPE "IakoMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "IakoGrantResource" AS ENUM ('IAKO_PROFILE', 'DIGITAL_TOOL', 'LIVE_TRAINING');

-- CreateTable
CREATE TABLE "iako_assistant_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "inScope" TEXT NOT NULL,
    "outOfScope" TEXT,
    "outOfScopeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iako_assistant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iako_profile_assignments" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "liveTrainingId" TEXT,
    "digitalToolKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iako_profile_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iako_knowledge_documents" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iako_knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iako_conversations" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "IakoGrantResource" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iako_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iako_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "IakoMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iako_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" TEXT NOT NULL,
    "resourceType" "IakoGrantResource" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_training_invites" (
    "id" TEXT NOT NULL,
    "liveTrainingId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_training_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_training_invite_redemptions" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_training_invite_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "iako_profile_assignments_liveTrainingId_key" ON "iako_profile_assignments"("liveTrainingId");

-- CreateIndex
CREATE UNIQUE INDEX "iako_profile_assignments_digitalToolKey_key" ON "iako_profile_assignments"("digitalToolKey");

-- CreateIndex
CREATE INDEX "iako_knowledge_documents_profileId_idx" ON "iako_knowledge_documents"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "iako_conversations_profileId_userId_resourceType_resourceId_key" ON "iako_conversations"("profileId", "userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "iako_messages_conversationId_createdAt_idx" ON "iako_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "access_grants_resourceType_resourceId_idx" ON "access_grants"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "access_grants_userId_idx" ON "access_grants"("userId");

-- CreateIndex
CREATE INDEX "access_grants_email_idx" ON "access_grants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "live_training_invites_token_key" ON "live_training_invites"("token");

-- CreateIndex
CREATE INDEX "live_training_invites_liveTrainingId_idx" ON "live_training_invites"("liveTrainingId");

-- CreateIndex
CREATE UNIQUE INDEX "live_training_invite_redemptions_inviteId_userId_key" ON "live_training_invite_redemptions"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "iako_assistant_profiles" ADD CONSTRAINT "iako_assistant_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_profile_assignments" ADD CONSTRAINT "iako_profile_assignments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "iako_assistant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_profile_assignments" ADD CONSTRAINT "iako_profile_assignments_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_knowledge_documents" ADD CONSTRAINT "iako_knowledge_documents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "iako_assistant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_conversations" ADD CONSTRAINT "iako_conversations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "iako_assistant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_conversations" ADD CONSTRAINT "iako_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iako_messages" ADD CONSTRAINT "iako_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "iako_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_invites" ADD CONSTRAINT "live_training_invites_liveTrainingId_fkey" FOREIGN KEY ("liveTrainingId") REFERENCES "live_trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_invites" ADD CONSTRAINT "live_training_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_invite_redemptions" ADD CONSTRAINT "live_training_invite_redemptions_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "live_training_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_training_invite_redemptions" ADD CONSTRAINT "live_training_invite_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
