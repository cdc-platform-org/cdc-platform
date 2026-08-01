import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

// mammoth 1.12.0 ships convertToMarkdown at runtime (confirmed via
// Object.keys(require('mammoth'))) but its bundled lib/index.d.ts only
// declares convertToHtml/extractRawText/embedStyleMap — a real gap in the
// package's own types, not a local resolution issue. Narrow, local
// augmentation rather than casting every call site to `any`.
const mammothTyped = mammoth as typeof mammoth & {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>;
};

// Converts an uploaded knowledge-base source file (PDF/DOCX/MD) into clean
// Markdown text, then splits it into reasonably-sized chunks. Used by both
// the CDC platform's own assistant knowledge base (routes/adminKnowledge.ts)
// and per-business agent knowledge bases (routes/agents.ts) — neither of
// those systems does real vector-embedding retrieval, they just concatenate
// KnowledgeDocument rows straight into the LLM's system prompt on every
// chat turn (see services/businessAiChatService.ts / pages/api/chat.ts), so
// converting messy PDF/DOCX extraction output into clean, minimal Markdown
// directly reduces the token cost of every single conversation turn.

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

const DOCX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
// Keeps each KnowledgeDocument row's content within a sane prompt-token
// budget — large sources are split into multiple rows at paragraph
// boundaries rather than mid-sentence.
const MAX_CHUNK_CHARS = 4000;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

// Strips the extraction noise both mammoth and pdf-parse leave behind
// (stray trailing whitespace, runs of blank lines from page breaks) without
// touching real Markdown syntax mammoth already produced.
function cleanMarkdown(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function parseDocumentToMarkdown(buffer: Buffer, mimetype: string, originalFilename: string): Promise<string> {
  const ext = extensionOf(originalFilename);

  if (mimetype === DOCX_MIMETYPE || ext === 'docx') {
    const result = await mammothTyped.convertToMarkdown({ buffer });
    const markdown = cleanMarkdown(result.value);
    if (!markdown) throw new DocumentParseError('This DOCX file has no extractable text.');
    return markdown;
  }

  if (mimetype === 'application/pdf' || ext === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const markdown = cleanMarkdown(result.text);
      if (!markdown) throw new DocumentParseError('This PDF has no extractable text (it may be a scanned image).');
      return markdown;
    } finally {
      await parser.destroy();
    }
  }

  if (mimetype === 'text/markdown' || mimetype === 'text/plain' || ext === 'md' || ext === 'txt') {
    const markdown = cleanMarkdown(buffer.toString('utf-8'));
    if (!markdown) throw new DocumentParseError('This file is empty.');
    return markdown;
  }

  throw new DocumentParseError('Unsupported file type. Please upload a PDF, DOCX, or Markdown (.md) file.');
}

// Splits on paragraph breaks, accumulating consecutive paragraphs until the
// next one would push a chunk past MAX_CHUNK_CHARS — never cuts a paragraph
// in half. A single paragraph longer than the limit becomes its own
// (oversized) chunk rather than being force-split mid-sentence.
export function chunkMarkdown(markdown: string, maxChunkChars: number = MAX_CHUNK_CHARS): string[] {
  const paragraphs = markdown.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChunkChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [markdown];
}
