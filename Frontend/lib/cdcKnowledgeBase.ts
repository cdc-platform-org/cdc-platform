const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CdcKnowledgeDocument {
  sourceFilename: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
}

let cached: { docs: CdcKnowledgeDocument[]; fetchedAt: number } | null = null;

// Admin-uploaded knowledge for the homepage CDC assistant (pages/api/chat.ts)
// — fetched server-side from Backend's public GET /api/admin/knowledge and
// cached in-memory for a few minutes so a busy chat doesn't hit the Backend
// on every single message. Fails soft: any error just means the assistant
// answers without the extra context, same as before this feature existed.
//
// `scopeToFilenames` narrows the context to specific uploaded documents —
// used when a PlatformAgent (routes/adminAiAgents.ts) is set as the
// homepage default and has its own assigned knowledge sources, rather than
// the full knowledge base every other caller gets. Undefined/empty means
// "no scoping", same as before this parameter existed; the full document
// set is still fetched either way (it's the same cached response the
// unscoped path already uses) and just filtered client-side, so this never
// costs an extra Backend round-trip.
export async function getCdcKnowledgeContext(scopeToFilenames?: string[]): Promise<string> {
  let allDocs: CdcKnowledgeDocument[] | null = null;
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    allDocs = cached.docs;
  } else {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/knowledge`);
      if (response.ok) {
        const { data } = (await response.json()) as { data: CdcKnowledgeDocument[] };
        cached = { docs: data, fetchedAt: Date.now() };
        allDocs = data;
      }
    } catch {
      // fall through to the stale cache (if any) below
    }
    if (!allDocs) allDocs = cached?.docs ?? [];
  }

  const scoped = scopeToFilenames?.length ? allDocs.filter((doc) => scopeToFilenames.includes(doc.sourceFilename)) : allDocs;
  return scoped.map((doc) => doc.content).join('\n\n---\n\n');
}
