/**
 * Course Mentor sources — text extraction for every supported file format.
 * Exports: SUPPORTED_FILE_EXTENSIONS, extensionOf, extractTextFromFile, ExtractedText.
 *
 * Formats:
 *  - PDF (text; scanned PDFs fall back to OCR in ocr.ts), DOCX (mammoth via
 *    ai/documentParserService), DOC (word-extractor), RTF;
 *  - PPTX/ODP slides, XLSX/ODS sheets, ODT, EPUB — all ZIP containers of XML,
 *    read with jszip + cheerio;
 *  - TXT, MD, CSV/TSV, JSON, HTML/HTM;
 *  - images (PNG/JPG/WEBP) -> OCR.
 * Not supported (and why) is listed in README.md.
 */
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';
import { parseDocumentToMarkdown } from '../../ai/documentParserService';
import { ocrImage, ocrScannedPdf } from './ocr';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WordExtractor = require('word-extractor');

export const SUPPORTED_FILE_EXTENSIONS = [
  'pdf', 'docx', 'doc', 'rtf', 'odt', 'pptx', 'odp', 'xlsx', 'ods', 'epub',
  'txt', 'md', 'csv', 'tsv', 'json', 'html', 'htm', 'png', 'jpg', 'jpeg', 'webp',
];

export interface ExtractedText {
  text: string;
  // Extra info for the teacher (e.g. "OCR: 120 pages").
  note?: string;
}

export function extensionOf(filename: string): string {
  const name = filename.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1);
}

// A PDF with less text than this per page is treated as a scan.
const MIN_CHARS_PER_PAGE = 80;

async function extractPdf(buffer: Buffer): Promise<ExtractedText> {
  const parser = new PDFParse({ data: buffer });
  let text = '';
  let pages = 1;
  try {
    const res = await parser.getText();
    text = res.text ?? '';
    pages = res.total || 1;
  } finally {
    await parser.destroy();
  }
  const meaningful = text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, '').replace(/\s+/g, '');
  if (meaningful.length / pages >= MIN_CHARS_PER_PAGE) return { text };
  const ocr = await ocrScannedPdf(buffer);
  return { text: ocr.text, note: `OCR: ${ocr.pages} pages${ocr.truncated ? ' (limit reached)' : ''}` };
}

function xmlText($: cheerio.CheerioAPI, selector: string, sep = ' '): string {
  return $(selector).map((_, el) => $(el).text()).get().join(sep);
}

async function extractPptx(zip: JSZip): Promise<string> {
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const $ = cheerio.load(await zip.file(name)!.async('string'), { xmlMode: true });
    const paras = $('a\\:p').map((_, p) => $(p).find('a\\:t').map((__, t) => $(t).text()).get().join('')).get().filter(Boolean);
    const notesName = `ppt/notesSlides/notesSlide${name.match(/\d+/)![0]}.xml`;
    let notes = '';
    if (zip.file(notesName)) {
      const $n = cheerio.load(await zip.file(notesName)!.async('string'), { xmlMode: true });
      notes = xmlText($n, 'a\\:t');
    }
    out.push(`## Slide ${i + 1}\n${paras.join('\n')}${notes ? `\n\nNotes: ${notes}` : ''}`);
  }
  return out.join('\n\n');
}

async function extractXlsx(zip: JSZip): Promise<string> {
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const shared: string[] = [];
  if (sharedXml) {
    const $ = cheerio.load(sharedXml, { xmlMode: true });
    $('si').each((_, si) => { shared.push($(si).find('t').map((__, t) => $(t).text()).get().join('')); });
  }
  const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  const out: string[] = [];
  for (const [i, name] of sheets.entries()) {
    const $ = cheerio.load(await zip.file(name)!.async('string'), { xmlMode: true });
    const rows = $('row').map((_, row) =>
      $(row).find('c').map((__, c) => {
        const v = $(c).find('v').first().text() || $(c).find('is t').text();
        return $(c).attr('t') === 's' ? shared[Number(v)] ?? '' : v;
      }).get().join(' | ')
    ).get().filter((r) => r.replace(/[|\s]/g, ''));
    out.push(`## Sheet ${i + 1}\n${rows.join('\n')}`);
  }
  return out.join('\n\n');
}

async function extractOpenDocument(zip: JSZip): Promise<string> {
  const xml = await zip.file('content.xml')?.async('string');
  if (!xml) return '';
  const $ = cheerio.load(xml, { xmlMode: true });
  return $('text\\:h, text\\:p, table\\:table-row').map((_, el) => $(el).text()).get().filter(Boolean).join('\n');
}

async function extractEpub(zip: JSZip): Promise<string> {
  // Reading order comes from the OPF spine.
  const container = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container ? cheerio.load(container, { xmlMode: true })('rootfile').attr('full-path') : undefined;
  const opf = opfPath ? await zip.file(opfPath)?.async('string') : undefined;
  if (!opfPath || !opf) return '';
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const $ = cheerio.load(opf, { xmlMode: true });
  const manifest = new Map($('manifest item').map((_, it) => [[$(it).attr('id') ?? '', $(it).attr('href') ?? '']] as [string, string][]).get());
  const out: string[] = [];
  for (const ref of $('spine itemref').map((_, r) => $(r).attr('idref') ?? '').get()) {
    const href = manifest.get(ref);
    const file = href ? zip.file(base + decodeURIComponent(href)) : null;
    if (file) out.push(htmlToText(await file.async('string')));
  }
  return out.join('\n\n');
}

// Readable text from HTML: drops scripts/navigation, keeps headings as Markdown.
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, aside, form, iframe, svg').remove();
  $('h1, h2, h3, h4').each((_, el) => { $(el).replaceWith(`\n\n${'#'.repeat(Number(el.tagName[1]))} ${$(el).text().trim()}\n\n`); });
  $('p, li, tr, br, div, section, article, pre').each((_, el) => { $(el).append('\n'); });
  const root = $('main').length ? $('main') : $('article').length ? $('article') : $('body');
  return root.text().replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(Number(n) < 0 ? Number(n) + 65536 : Number(n)))
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .trim();
}

export async function extractTextFromFile(buffer: Buffer, filename: string, mimeType: string): Promise<ExtractedText> {
  const ext = extensionOf(filename);
  switch (ext) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return { text: await parseDocumentToMarkdown(buffer, mimeType, filename) };
    case 'doc': {
      const doc = await new WordExtractor().extract(buffer);
      return { text: doc.getBody() as string };
    }
    case 'rtf':
      return { text: rtfToText(buffer.toString('latin1')) };
    case 'pptx':
      return { text: await extractPptx(await JSZip.loadAsync(buffer)) };
    case 'xlsx':
      return { text: await extractXlsx(await JSZip.loadAsync(buffer)) };
    case 'odt': case 'odp': case 'ods':
      return { text: await extractOpenDocument(await JSZip.loadAsync(buffer)) };
    case 'epub':
      return { text: await extractEpub(await JSZip.loadAsync(buffer)) };
    case 'html': case 'htm':
      return { text: htmlToText(buffer.toString('utf8')) };
    case 'png': case 'jpg': case 'jpeg': case 'webp':
      return { text: await ocrImage(buffer, ext === 'jpg' ? 'image/jpeg' : `image/${ext}`), note: 'OCR: 1 image' };
    case 'txt': case 'md': case 'csv': case 'tsv': case 'json':
      return { text: buffer.toString('utf8') };
    default:
      throw new Error(`Unsupported file type ".${ext}".`);
  }
}
