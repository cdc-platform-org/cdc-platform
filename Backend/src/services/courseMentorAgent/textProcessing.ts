/**
 * Course Mentor Agent — turning extracted document text into chunks + outline.
 * Exports: cleanExtractedText, detectHeading, chunkWithHeadings, buildOutline, SourceChunkDraft.
 *
 * Pure functions (no I/O). File parsing itself (PDF/DOCX -> text) is reused
 * from services/ai/documentParserService.ts; this file only adds what the
 * mentor needs on top: page-noise cleanup, heading detection and
 * heading-aware chunks so every chunk knows which section it belongs to.
 */
import { OutlineEntry } from './types';

const TARGET_CHUNK_CHARS = 2400;
const MIN_CHUNK_CHARS_BEFORE_HEADING_SPLIT = 700;

export interface SourceChunkDraft {
  position: number;
  heading: string | null;
  content: string;
}

export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\t+/g, ' ')
    // pdf-parse page separators ("-- 3 of 59 --") and centred page numbers ("- 12 -").
    .replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, '')
    .replace(/^\s*-\s*\d{1,4}\s*-\s*$/gm, '')
    .replace(/^\s*\d{1,4}\s*$/gm, '')
    .replace(/[  ]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Table-of-contents lines end with dot leaders and a page number.
const TOC_LINE = /^(.{3,160}?)\s*[.…·]{4,}\s*-?\s*\d{1,4}\s*-?\s*$/;
const MARKDOWN_HEADING = /^(#{1,4})\s+(.{2,160})$/;
const CHAPTER_HEADING = /^(თავი|chapter|მოდული|module|ნაწილი|part)\s+[\dIVXLC]+[.:]?\s*(.{0,150})$/i;
const NUMBERED_HEADING = /^(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+(\S.{2,150})$/;

export interface DetectedHeading {
  title: string;
  level: number;
  fromToc: boolean;
}

// Recognises a heading line. Single-level numbers ("1. თუ ...") are left
// out on purpose: in textbooks they are mostly numbered list items
// (algorithm steps, questions), not sections.
// TOC titles whose page number was lost still end in dot leaders.
function stripLeaders(title: string): string {
  return title.replace(/\s*[.…·]{3,}\s*-?\s*\d{0,4}\s*-?\s*$/, '').trim();
}

export function detectHeading(line: string): DetectedHeading | null {
  const text = line.trim();
  if (text.length < 4 || text.length > 260) return null;

  const toc = TOC_LINE.exec(text);
  if (toc) {
    const title = toc[1].trim();
    const numbered = /^(\d{1,2}(?:\.\d{1,2})*)\.?\s/.exec(title);
    const level = numbered ? numbered[1].split('.').filter(Boolean).length : 1;
    return { title, level, fromToc: true };
  }

  const md = MARKDOWN_HEADING.exec(text);
  if (md) return { title: md[2].trim(), level: md[1].length, fromToc: false };

  if (CHAPTER_HEADING.test(text)) return { title: text, level: 1, fromToc: false };

  const numbered = NUMBERED_HEADING.exec(text);
  if (numbered && !/[;:,]$/.test(text) && !/\s{2,}/.test(numbered[2])) {
    // A numbered line that still has dot leaders is a TOC entry whose page
    // number was cut off by the PDF extractor.
    const hadLeaders = /[.…·]{4,}/.test(text);
    return { title: stripLeaders(text), level: numbered[1].split('.').length, fromToc: hadLeaders };
  }
  return null;
}

// Paragraph accumulation that starts a fresh chunk at body headings, so a
// chunk rarely mixes two sections; table-of-contents lines never split.
export function chunkWithHeadings(text: string, targetChars: number = TARGET_CHUNK_CHARS): SourceChunkDraft[] {
  const chunks: SourceChunkDraft[] = [];
  let currentHeading: string | null = null;
  let chunkHeading: string | null = null;
  let buffer: string[] = [];
  let size = 0;

  const flush = () => {
    const content = buffer.join('\n').trim();
    if (content) chunks.push({ position: chunks.length, heading: chunkHeading, content });
    buffer = [];
    size = 0;
    chunkHeading = currentHeading;
  };

  for (const line of text.split('\n')) {
    const heading = detectHeading(line);
    if (heading && !heading.fromToc) {
      if (size >= MIN_CHUNK_CHARS_BEFORE_HEADING_SPLIT) flush();
      currentHeading = heading.title;
      if (size === 0) chunkHeading = currentHeading;
    }
    if (size + line.length > targetChars && size > 0) flush();
    buffer.push(line);
    size += line.length + 1;
  }
  flush();
  return chunks;
}

// The outline the planner reads. Prefers the book's own table of contents
// (it is complete and ordered); falls back to body headings. Each entry
// points at the first chunk whose heading matches, so the planner's
// choices can be mapped back to real text.
export function buildOutline(text: string, chunks: SourceChunkDraft[], maxEntries = 400): OutlineEntry[] {
  const toc: DetectedHeading[] = [];
  const body: DetectedHeading[] = [];
  for (const line of text.split('\n')) {
    const h = detectHeading(line);
    if (!h) continue;
    (h.fromToc ? toc : body).push(h);
  }
  let source = toc.length >= 5 ? toc : body;
  // Big books: keep the whole book visible by dropping the deepest heading
  // levels first, rather than cutting the second half of the book off.
  for (let depth = 4; source.length > maxEntries && depth > 1; depth--) {
    const shallower = source.filter((h) => h.level < depth);
    if (shallower.length === 0) break;
    source = shallower;
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const chunkIndex = new Map<string, number>();
  for (const c of chunks) {
    if (c.heading) {
      const key = normalize(c.heading);
      if (!chunkIndex.has(key)) chunkIndex.set(key, c.position);
    }
  }

  const seen = new Set<string>();
  const outline: OutlineEntry[] = [];
  let lastPosition = 0;
  for (const h of source) {
    const key = normalize(h.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const position = chunkIndex.get(key) ?? lastPosition;
    lastPosition = position;
    outline.push({ title: h.title, level: h.level, chunkPosition: position });
    if (outline.length >= maxEntries) break;
  }
  return outline;
}
