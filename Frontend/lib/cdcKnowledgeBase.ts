const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CdcKnowledgeDocument {
  sourceFilename: string;
  chunkIndex: number;
  totalChunks: number;
  content: string;
}

let cached: { text: string; fetchedAt: number } | null = null;

// Admin-uploaded knowledge for the homepage CDC assistant (pages/api/chat.ts)
// — fetched server-side from Backend's public GET /api/admin/knowledge and
// cached in-memory for a few minutes so a busy chat doesn't hit the Backend
// on every single message. Fails soft: any error just means the assistant
// answers without the extra context, same as before this feature existed.
export async function getCdcKnowledgeContext(): Promise<string> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.text;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/admin/knowledge`);
    if (!response.ok) return cached?.text ?? '';
    const { data } = (await response.json()) as { data: CdcKnowledgeDocument[] };
    const text = data.map((doc) => doc.content).join('\n\n---\n\n');
    cached = { text, fetchedAt: Date.now() };
    return text;
  } catch {
    return cached?.text ?? '';
  }
}
