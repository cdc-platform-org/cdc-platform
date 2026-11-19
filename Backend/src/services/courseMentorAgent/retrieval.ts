/**
 * Course Mentor Agent — finding the right passages in the teacher's documents.
 * Exports: RetrievedChunk, tokenize, keywordScores, cosineSimilarity, searchCourseChunks,
 * clearRetrievalCache.
 *
 * Two strategies behind one function:
 *  - semantic: cosine similarity over Azure OpenAI embeddings (when the
 *    embedding deployment is configured and the chunks have vectors);
 *  - keyword: a small BM25-style score — always available, no Azure cost.
 * The final score blends both when both exist. Chunks of one course are
 * cached in memory for a few minutes because the planner and the lesson
 * runner query the same course many times in a row. (If courses grow past a
 * few thousand chunks, move vectors to pgvector instead of this cache.)
 */
import { prisma } from '../../lib/prisma';
import { embedTexts, isEmbeddingConfigured } from './embeddings';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  position: number;
  heading: string | null;
  content: string;
  score: number;
}

interface CachedChunk {
  id: string;
  documentId: string;
  position: number;
  heading: string | null;
  content: string;
  embedding: number[];
  terms: Map<string, number>;
  length: number;
}

interface CourseIndex {
  loadedAt: number;
  chunks: CachedChunk[];
  docFreq: Map<string, number>;
  avgLength: number;
}

const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHED_COURSES = 3;
const cache = new Map<string, CourseIndex>();

export function clearRetrievalCache(courseId?: string): void {
  if (courseId) cache.delete(courseId);
  else cache.clear();
}

// Lowercased letter/digit runs; keeps Georgian, Latin and code identifiers.
// Very short tokens carry no meaning for search.
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}_$]{2,}/gu) ?? []).slice(0, 5000);
}

function termCounts(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// BM25 (k1 = 1.2, b = 0.75) over the cached term counts.
export function keywordScores(queryTerms: string[], index: Pick<CourseIndex, 'chunks' | 'docFreq' | 'avgLength'>): number[] {
  const n = index.chunks.length;
  const unique = [...new Set(queryTerms)];
  return index.chunks.map((c) => {
    let score = 0;
    for (const term of unique) {
      const tf = c.terms.get(term);
      if (!tf) continue;
      const df = index.docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      score += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (c.length / (index.avgLength || 1)))));
    }
    return score;
  });
}

async function loadCourseIndex(courseId: string): Promise<CourseIndex> {
  const cached = cache.get(courseId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached;

  const rows = await prisma.mentorSourceChunk.findMany({
    where: { courseId, document: { status: 'READY' } },
    select: { id: true, documentId: true, position: true, heading: true, content: true, embedding: true },
    orderBy: [{ documentId: 'asc' }, { position: 'asc' }],
  });
  const docFreq = new Map<string, number>();
  const chunks: CachedChunk[] = rows.map((r) => {
    const tokens = tokenize(`${r.heading ?? ''} ${r.heading ?? ''} ${r.content}`);
    const terms = termCounts(tokens);
    for (const t of terms.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    return { ...r, terms, length: tokens.length };
  });
  const avgLength = chunks.reduce((s, c) => s + c.length, 0) / (chunks.length || 1);
  const index: CourseIndex = { loadedAt: Date.now(), chunks, docFreq, avgLength };

  if (cache.size >= MAX_CACHED_COURSES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].loadedAt - b[1].loadedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(courseId, index);
  return index;
}

export async function searchCourseChunks(
  courseId: string,
  query: string,
  options: { limit?: number; documentIds?: string[] } = {}
): Promise<RetrievedChunk[]> {
  const limit = options.limit ?? 6;
  const index = await loadCourseIndex(courseId);
  if (index.chunks.length === 0) return [];

  const kw = keywordScores(tokenize(query), index);
  const maxKw = Math.max(...kw, 0) || 1;

  let semantic: number[] | null = null;
  const hasVectors = index.chunks.some((c) => c.embedding.length > 0);
  if (hasVectors && isEmbeddingConfigured()) {
    try {
      const [q] = await embedTexts([query]);
      semantic = index.chunks.map((c) => cosineSimilarity(q, c.embedding));
    } catch (err) {
      // Search must keep working if Azure embeddings hiccup — keyword only.
      console.error('[courseMentor/retrieval] query embedding failed, using keyword search:', (err as Error).message);
    }
  }

  const allowed = options.documentIds?.length ? new Set(options.documentIds) : null;
  return index.chunks
    .map((c, i) => ({
      c,
      score: semantic ? 0.7 * semantic[i] + 0.3 * (kw[i] / maxKw) : kw[i] / maxKw,
    }))
    .filter(({ c, score }) => score > 0 && (!allowed || allowed.has(c.documentId)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, score }) => ({ id: c.id, documentId: c.documentId, position: c.position, heading: c.heading, content: c.content, score }));
}
