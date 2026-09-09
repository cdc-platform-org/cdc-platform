import { prisma } from '../lib/prisma';
import { parseDocumentToMarkdown, chunkMarkdown, DocumentParseError } from './documentParserService';

export { DocumentParseError };

// Same parse -> chunk -> replace-by-filename pipeline as
// routes/adminKnowledge.ts's site-wide assistant upload, just scoped to one
// IakoAssistantProfile's knowledge base instead of the global one.
export async function uploadKnowledgeDocument(profileId: string, file: { buffer: Buffer; mimetype: string; originalname: string }) {
  const markdown = await parseDocumentToMarkdown(file.buffer, file.mimetype, file.originalname);
  const chunks = chunkMarkdown(markdown);
  const sourceFilename = file.originalname;
  return prisma.$transaction(async (tx) => {
    await tx.iakoKnowledgeDocument.deleteMany({ where: { profileId, sourceFilename } });
    return Promise.all(
      chunks.map((content, i) => tx.iakoKnowledgeDocument.create({
        data: { profileId, sourceFilename, chunkIndex: i, totalChunks: chunks.length, content },
      }))
    );
  });
}

export async function listKnowledgeSources(profileId: string) {
  const documents = await prisma.iakoKnowledgeDocument.findMany({
    where: { profileId }, orderBy: [{ sourceFilename: 'asc' }, { chunkIndex: 'asc' }],
  });
  const bySource = new Map<string, { sourceFilename: string; totalChunks: number; totalChars: number; updatedAt: Date }>();
  for (const doc of documents) {
    const existing = bySource.get(doc.sourceFilename);
    if (existing) { existing.totalChars += doc.content.length; if (doc.updatedAt > existing.updatedAt) existing.updatedAt = doc.updatedAt; }
    else bySource.set(doc.sourceFilename, { sourceFilename: doc.sourceFilename, totalChunks: doc.totalChunks, totalChars: doc.content.length, updatedAt: doc.updatedAt });
  }
  return Array.from(bySource.values());
}

export async function deleteKnowledgeSource(profileId: string, sourceFilename: string) {
  return prisma.iakoKnowledgeDocument.deleteMany({ where: { profileId, sourceFilename } });
}

const STOPWORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'i', 'you', 'it', 'this', 'that', 'do', 'does', 'how', 'what', 'can']);
function queryTerms(text: string): string[] {
  return Array.from(new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])).filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

// No vector store in this stack (Postgres only) — retrieval is a plain
// lexical term-overlap score, same "good enough, no new infra" posture as
// trainingGuideService.ts's day-scoped TrainingGuideSource lookup. Ranks
// every chunk by how many distinct query terms it contains (case-
// insensitive), returns the top `limit` non-zero-score chunks so an
// unrelated knowledge base contributes nothing to context rather than
// diluting it with irrelevant "best effort" matches.
export async function retrieveKnowledge(profileId: string, query: string, limit = 6): Promise<Array<{ sourceFilename: string; content: string }>> {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const documents = await prisma.iakoKnowledgeDocument.findMany({ where: { profileId }, select: { sourceFilename: true, content: true } });
  const scored = documents
    .map((doc) => {
      const lower = doc.content.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((entry) => ({ sourceFilename: entry.doc.sourceFilename, content: entry.doc.content.slice(0, 6000) }));
}
