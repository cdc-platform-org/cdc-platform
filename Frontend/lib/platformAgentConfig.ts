const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface HomepageAgentConfig {
  systemPrompt: string;
  knowledgeSourceFilenames: string[];
}

let cached: { config: HomepageAgentConfig | null; fetchedAt: number } | null = null;

// Whichever PlatformAgent an admin has set as the homepage default (see
// routes/adminAiAgents.ts's /homepage-config) — null when none is set,
// which callers (pages/api/chat.ts) read as "keep using the existing
// hardcoded SYSTEM_PROMPT / full knowledge base, unchanged". Same
// fail-soft, in-memory-cached posture as getCdcKnowledgeContext in
// cdcKnowledgeBase.ts, for the same reason (don't hit the Backend on every
// chat message; a transient error should never break the widget).
export async function getHomepageAgentConfig(): Promise<HomepageAgentConfig | null> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/admin/ai-agents/homepage-config`);
    if (!response.ok) return cached?.config ?? null;
    const { data } = (await response.json()) as { data: HomepageAgentConfig | null };
    cached = { config: data, fetchedAt: Date.now() };
    return data;
  } catch {
    return cached?.config ?? null;
  }
}
