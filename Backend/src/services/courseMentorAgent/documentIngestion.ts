/**
 * Course Mentor Agent — ingesting a teacher's source document (file or link).
 * Exports: SUPPORTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES, ingestDocument, ingestUrl, ingestText, processDocument.
 *
 * Flow: upload / link -> MentorSourceDocument(PROCESSING) row -> background job:
 * extract text (sources/: every file format, web pages, Google links,
 * YouTube captions, OCR for scans) -> clean + legacy-font repair -> chunks with
 * headings -> outline -> embeddings (when configured) -> READY.
 * The HTTP request returns right after the row is created; the teacher's
 * page polls the document status.
 */
import { prisma } from '../../lib/prisma';
import { extractTextFromFile, SUPPORTED_FILE_EXTENSIONS } from './sources/fileExtractors';
import { extractTextFromUrl } from './sources/urlSources';
import { uploadToSpace } from '../storage';
import { cleanExtractedText, chunkWithHeadings, buildOutline } from './textProcessing';
import { repairLegacyGeorgianText } from './legacyGeorgianFont';
import { embedTexts, isEmbeddingConfigured } from './embeddings';
import { clearRetrievalCache } from './retrieval';

export const SUPPORTED_UPLOAD_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS;
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const MAX_TEXT_CHARS = 3_000_000; // ~1500 textbook pages; protects memory and cost
const INSERT_BATCH = 200;

export async function ingestDocument(
  courseId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number }
): Promise<{ id: string }> {
  const doc = await prisma.mentorSourceDocument.create({
    data: {
      courseId,
      filename: file.originalname.slice(0, 250),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      status: 'PROCESSING',
    },
    select: { id: true },
  });

  // Fire-and-forget: the request must not wait for a 600-page book.
  // processDocument records its own failure on the row.
  setImmediate(() => {
    processDocument(doc.id, courseId, { kind: 'file', ...file }).catch((err) =>
      console.error('[courseMentor/ingest] unexpected failure', doc.id, err)
    );
  });
  return doc;
}

export async function ingestUrl(courseId: string, url: string, locale: string): Promise<{ id: string }> {
  const doc = await prisma.mentorSourceDocument.create({
    data: { courseId, filename: url.slice(0, 250), mimeType: 'text/uri-list', sizeBytes: 0, sourceUrl: url.slice(0, 2000), status: 'PROCESSING' },
    select: { id: true },
  });
  setImmediate(() => {
    processDocument(doc.id, courseId, { kind: 'url', url, locale }).catch((err) =>
      console.error('[courseMentor/ingest] unexpected failure', doc.id, err)
    );
  });
  return doc;
}

// Pasted text (e.g. a YouTube transcript, notes, an article) — no fetch, no AI.
export async function ingestText(courseId: string, title: string, text: string): Promise<{ id: string }> {
  const doc = await prisma.mentorSourceDocument.create({
    data: { courseId, filename: title.slice(0, 250), mimeType: 'text/plain', sizeBytes: Buffer.byteLength(text), status: 'PROCESSING' },
    select: { id: true },
  });
  setImmediate(() => {
    processDocument(doc.id, courseId, { kind: 'text', text }).catch((err) => console.error('[courseMentor/ingest] unexpected failure', doc.id, err));
  });
  return doc;
}

type SourceInput =
  | { kind: 'file'; buffer: Buffer; originalname: string; mimetype: string }
  | { kind: 'url'; url: string; locale: string }
  | { kind: 'text'; text: string };

export async function processDocument(documentId: string, courseId: string, source: SourceInput): Promise<void> {
  try {
    let storageUrl: string | null = null;
    let raw: string;
    let note: string | null = null;
    let title: string | null = null;
    if (source.kind === 'text') {
      raw = source.text;
    } else if (source.kind === 'url') {
      const res = await extractTextFromUrl(source.url, source.locale);
      raw = res.text;
      note = res.note ?? null;
      title = res.title;
    } else {
      storageUrl = await storeOriginal(courseId, source);
      const res = await extractTextFromFile(source.buffer, source.originalname, source.mimetype);
      raw = res.text;
      note = res.note ?? null;
    }
    const { text } = repairLegacyGeorgianText(cleanExtractedText(raw).slice(0, MAX_TEXT_CHARS));
    const chunks = chunkWithHeadings(text);
    if (chunks.length === 0) throw new Error('No readable text was found in this document.');
    const outline = buildOutline(text, chunks);

    let vectors: number[][] = [];
    if (isEmbeddingConfigured()) {
      try {
        vectors = await embedTexts(chunks.map((c) => `${c.heading ?? ''}\n${c.content}`));
      } catch (err) {
        // Keyword search still works without vectors; don't fail the upload.
        console.error('[courseMentor/ingest] embeddings failed, continuing without:', (err as Error).message);
        vectors = [];
      }
    }

    await prisma.mentorSourceChunk.deleteMany({ where: { documentId } });
    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      await prisma.mentorSourceChunk.createMany({
        data: chunks.slice(i, i + INSERT_BATCH).map((c) => ({
          courseId,
          documentId,
          position: c.position,
          heading: c.heading?.slice(0, 300) ?? null,
          content: c.content,
          embedding: vectors[c.position] ?? [],
        })),
      });
    }

    await prisma.mentorSourceDocument.update({
      where: { id: documentId },
      data: {
        status: 'READY',
        storageUrl,
        charCount: text.length,
        chunkCount: chunks.length,
        outline: outline as unknown as object,
        note,
        ...(title ? { filename: title.slice(0, 250) } : {}),
        error: null,
      },
    });
    clearRetrievalCache(courseId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[courseMentor/ingest] failed', documentId, message);
    await prisma.mentorSourceDocument
      .update({ where: { id: documentId }, data: { status: 'FAILED', error: message.slice(0, 1000) } })
      .catch(() => undefined); // the document may have been deleted meanwhile
  }
}

// Keep the original file for the teacher's reference. Storage is optional
// (local dev has no blob account) — the extracted text is what matters.
async function storeOriginal(courseId: string, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<string | null> {
  try {
    const stored = await uploadToSpace('private-media', {
      buffer: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
      filename: file.originalname,
      folder: `course-mentor/${courseId}`,
    });
    return stored.url;
  } catch (err) {
    console.warn('[courseMentor/ingest] original file not stored:', (err as Error).message);
    return null;
  }
}
