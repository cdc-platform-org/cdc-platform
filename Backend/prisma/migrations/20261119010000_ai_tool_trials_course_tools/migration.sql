-- Additive only: per-user AI tool trials and the course -> AI tools link.
CREATE TABLE "ai_tool_trials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "usedUnits" INTEGER NOT NULL DEFAULT 0,
    "capUnits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_tool_trials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_tool_trials_userId_toolKey_key" ON "ai_tool_trials"("userId", "toolKey");
CREATE INDEX "ai_tool_trials_userId_idx" ON "ai_tool_trials"("userId");
ALTER TABLE "ai_tool_trials" ADD CONSTRAINT "ai_tool_trials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courses" ADD COLUMN "aiToolKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Default course -> AI tools mapping from each course's category/title
-- (admins edit it afterwards on the course edit page). Only fills the new,
-- still-empty column; no existing data is changed.
UPDATE "courses" SET "aiToolKeys" = ARRAY['design-studio','media-studio']::TEXT[]
  WHERE cardinality("aiToolKeys") = 0 AND (category || ' ' || title) ~* '(დიზაინ|design|გრაფიკ|graphic|ფოტო|photo|ვიდეო|video)';
UPDATE "courses" SET "aiToolKeys" = ARRAY['english-tutor','smart-reader']::TEXT[]
  WHERE cardinality("aiToolKeys") = 0 AND (category || ' ' || title) ~* '(ინგლის|english)';
UPDATE "courses" SET "aiToolKeys" = ARRAY['code-studio']::TEXT[]
  WHERE cardinality("aiToolKeys") = 0 AND (category || ' ' || title) ~* '(პროგრამ|programming|code|sql|web|frontend|backend|python|javascript)';
UPDATE "courses" SET "aiToolKeys" = ARRAY['educator-hub']::TEXT[]
  WHERE cardinality("aiToolKeys") = 0 AND (category || ' ' || title) ~* '(მასწავლ|teacher|educat|პედაგოგ)';
UPDATE "courses" SET "aiToolKeys" = ARRAY['ai-agents','chatbot-builder']::TEXT[]
  WHERE cardinality("aiToolKeys") = 0 AND (category || ' ' || title) ~* '(ბიზნეს|business|მარკეტინგ|marketing|startup|სტარტაპ)';
