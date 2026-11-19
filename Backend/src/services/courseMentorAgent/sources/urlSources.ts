/**
 * Course Mentor sources — learning material from a link.
 * Exports: MAX_URL_BYTES, extractTextFromUrl, rewriteShareLink, youtubeVideoId, assertPublicHost.
 *
 * Supports: any public web page (readable text), direct file links (routed to
 * fileExtractors.ts by type), Google Docs / Slides / Sheets / Drive links that
 * are shared "anyone with the link" (rewritten to their export URLs), and
 * YouTube captions when YouTube serves them. Since 2025 YouTube often blocks
 * caption downloads without a browser token; then the teacher gets a clear
 * message to paste the transcript instead (documentIngestion.ingestText).
 * Security: the URL comes from a user, so every hop (incl. redirects) must
 * resolve to a public IP — no localhost, private ranges or cloud metadata
 * endpoints (SSRF) — and size/time are capped.
 */
import dns from 'dns/promises';
import net from 'net';
import { extractTextFromFile, htmlToText, extensionOf, ExtractedText, SUPPORTED_FILE_EXTENSIONS } from './fileExtractors';

export const MAX_URL_BYTES = 40 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 4;
const UA = 'Mozilla/5.0 (compatible; CDC-Mentor/1.0)';

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') ||
    (v6.startsWith('::ffff:') && isPrivateAddress(v6.slice(7)));
}

export async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http(s) links are supported.');
  if (url.username || url.password) throw new Error('Links with credentials are not allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) throw new Error('This link points to a private address.');
}

async function safeFetch(rawUrl: string): Promise<{ buffer: Buffer; contentType: string; finalUrl: URL; filename: string }> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': UA, accept: '*/*' } });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      continue;
    }
    if (!res.ok) throw new Error(`The link returned HTTP ${res.status}. Is it public?`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_URL_BYTES) throw new Error('The linked file is too large (max 40 MB).');
    const reader = res.body?.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_URL_BYTES) {
        await reader.cancel();
        throw new Error('The linked file is too large (max 40 MB).');
      }
      parts.push(value);
    }
    const disposition = res.headers.get('content-disposition') ?? '';
    const named = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition)?.[1];
    const filename = decodeURIComponent(named ?? url.pathname.split('/').pop() ?? 'download');
    return { buffer: Buffer.concat(parts), contentType: (res.headers.get('content-type') ?? '').toLowerCase(), finalUrl: url, filename };
  }
  throw new Error('Too many redirects.');
}

// Google "share" links -> direct export of a readable format.
export function rewriteShareLink(raw: string): string {
  const u = new URL(raw);
  if (u.hostname === 'docs.google.com') {
    const m = /^\/(document|presentation|spreadsheets)\/d\/([\w-]+)/.exec(u.pathname);
    if (m) {
      const fmt = m[1] === 'document' ? 'docx' : m[1] === 'presentation' ? 'pptx' : 'xlsx';
      return `https://docs.google.com/${m[1]}/d/${m[2]}/export?format=${fmt}`;
    }
  }
  if (u.hostname === 'drive.google.com') {
    const id = /\/file\/d\/([\w-]+)/.exec(u.pathname)?.[1] ?? u.searchParams.get('id');
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return raw;
}

export function youtubeVideoId(raw: string): string | null {
  const u = new URL(raw);
  if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
  if (/(^|\.)youtube\.com$/.test(u.hostname)) {
    return u.searchParams.get('v') ?? /^\/(shorts|embed|live)\/([\w-]{6,})/.exec(u.pathname)?.[2] ?? null;
  }
  return null;
}

// Captions via the public watch page's caption tracks. Prefers the
// teacher's language, then any manual track, then auto-generated.
async function youtubeTranscript(videoId: string, preferLang: string): Promise<ExtractedText> {
  const page = await safeFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=${preferLang}`);
  const html = page.buffer.toString('utf8');
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.replace(/ - YouTube$/, '') ?? 'YouTube';
  const tracksJson = /"captionTracks":(\[.*?\])/.exec(html)?.[1];
  if (!tracksJson) throw new Error('YouTube does not allow automatic transcript download for this video. Open the video, click "...more" -> "Show transcript", copy the text and add it with "Paste text".');
  const tracks = JSON.parse(tracksJson) as { baseUrl: string; languageCode: string; kind?: string }[];
  const pick =
    tracks.find((t) => t.languageCode === preferLang && t.kind !== 'asr') ??
    tracks.find((t) => t.kind !== 'asr') ??
    tracks.find((t) => t.languageCode === preferLang) ??
    tracks[0];
  const xml = (await safeFetch(pick.baseUrl.replace(/\\u0026/g, '&'))).buffer.toString('utf8');
  const lines = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    m[1].replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;quot;|&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  );
  if (lines.length === 0) throw new Error('YouTube does not allow automatic transcript download for this video. Open the video, click "...more" -> "Show transcript", copy the text and add it with "Paste text".');
  return { text: `# ${title}\n\n${lines.join(' ').replace(/\s+/g, ' ')}`, note: `YouTube captions (${pick.languageCode})` };
}

export async function extractTextFromUrl(raw: string, preferLang = 'ka'): Promise<ExtractedText & { title: string }> {
  const ytId = youtubeVideoId(raw);
  if (ytId) {
    const t = await youtubeTranscript(ytId, preferLang);
    return { ...t, title: t.text.split('\n')[0].replace(/^# /, '') };
  }
  const fetched = await safeFetch(rewriteShareLink(raw));
  const ext = extensionOf(fetched.filename);
  if (fetched.contentType.includes('text/html') && !SUPPORTED_FILE_EXTENSIONS.includes(ext)) {
    const html = fetched.buffer.toString('utf8');
    if (/accounts\.google\.com|ServiceLogin/.test(fetched.finalUrl.href)) throw new Error('This Google link is not shared publicly ("Anyone with the link").');
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || fetched.finalUrl.hostname;
    return { text: htmlToText(html), title };
  }
  // A file behind the link: pick the parser from the extension, falling back to the content type.
  const byType: Record<string, string> = {
    'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/epub+zip': 'epub', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  };
  const type = SUPPORTED_FILE_EXTENSIONS.includes(ext) ? ext : byType[fetched.contentType.split(';')[0].trim()];
  if (!type) throw new Error('This link does not point to a supported page or file.');
  const name = SUPPORTED_FILE_EXTENSIONS.includes(ext) ? fetched.filename : `${fetched.filename}.${type}`;
  const extracted = await extractTextFromFile(fetched.buffer, name, fetched.contentType);
  return { ...extracted, title: fetched.filename };
}
