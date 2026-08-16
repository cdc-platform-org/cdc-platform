-- CreateTable
CREATE TABLE "platform_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_agent_knowledge_sources" (
    "id" TEXT NOT NULL,
    "platformAgentId" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_agent_knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_agents_slug_key" ON "platform_agents"("slug");

-- CreateIndex
CREATE INDEX "platform_agent_knowledge_sources_platformAgentId_idx" ON "platform_agent_knowledge_sources"("platformAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_agent_knowledge_sources_platformAgentId_sourceFile_key" ON "platform_agent_knowledge_sources"("platformAgentId", "sourceFilename");

-- AddForeignKey
ALTER TABLE "platform_agent_knowledge_sources" ADD CONSTRAINT "platform_agent_knowledge_sources_platformAgentId_fkey" FOREIGN KEY ("platformAgentId") REFERENCES "platform_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed 3 example agents (from this feature's own spec) so the admin UI
-- isn't empty on first load. All isActive=true, isDefault=false — the CDC
-- homepage assistant keeps using its existing hardcoded prompt/full
-- knowledge base unchanged until an admin explicitly sets one of these as
-- the homepage default (see PlatformAgent's schema comment).
INSERT INTO "platform_agents" ("id", "name", "nameEn", "slug", "systemPrompt", "isActive", "isDefault", "createdAt", "updatedAt") VALUES
('00000000-0000-4000-8000-000000000001', 'მთავარი დახმარების ბოტი', 'Main Support Bot', 'main-support-bot', 'You are the official AI Career Assistant for CDC (Digital Careers Center) in Guria, Georgia. Answer general questions about CDC''s courses, admissions, and platform features. Be helpful, encouraging, and concise. Decline and redirect only questions genuinely unrelated to CDC or tech/career topics.', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000002', 'კარიერული მრჩეველი', 'Career Advisor', 'career-advisor', 'You are CDC''s Career Advisor. Help visitors figure out which digital career path and CDC course fits their interests, experience level, and goals. Ask clarifying questions before recommending a path. Be encouraging and specific about real next steps.', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000003', 'რეზიუმეს შემფასებელი', 'Resume Reviewer', 'resume-reviewer', 'You are CDC''s Resume Reviewer. Give constructive, specific feedback on resumes/CVs shared by students and graduates — clarity, structure, and how well they highlight relevant skills for tech/digital roles. Be direct but encouraging, and prioritize the 2-3 changes that would help most.', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
