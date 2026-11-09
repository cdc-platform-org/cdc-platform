import { prisma } from '../lib/prisma';
import { readBookAsset } from './bookStorageService';

// ============================================================
// Children's Book — the whole story as ONE audio file. Each page is
// narrated separately (so a single page can be re-narrated without
// re-billing the rest); for "download the audiobook" the page files are
// joined. MP3 is a stream of self-contained frames, so files with the same
// encoder settings (all pages come from the same speech voice/format) play
// back-to-back when concatenated; only per-file ID3 tags are dropped.
// ============================================================

// Latest READY narration per page, in page order.
export async function latestNarrations(bookId: string) {
  const artifacts = await prisma.bookNarrationArtifact.findMany({
    where: { bookProjectId: bookId, status: 'READY', artifactKey: { not: null } },
    orderBy: [{ pageNumber: 'asc' }, { revisionVersion: 'desc' }],
  });
  const byPage = new Map<number, (typeof artifacts)[number]>();
  for (const artifact of artifacts) if (!byPage.has(artifact.pageNumber)) byPage.set(artifact.pageNumber, artifact);
  return [...byPage.values()];
}

export function stripId3(buffer: Buffer): Buffer {
  let out = buffer;
  // ID3v2 header: "ID3", version(2), flags(1), size(4, syncsafe).
  if (out.length > 10 && out.toString('latin1', 0, 3) === 'ID3') {
    const size = ((out[6] & 0x7f) << 21) | ((out[7] & 0x7f) << 14) | ((out[8] & 0x7f) << 7) | (out[9] & 0x7f);
    const footer = out[5] & 0x10 ? 10 : 0;
    out = out.subarray(Math.min(out.length, 10 + size + footer));
  }
  // ID3v1 trailer: last 128 bytes starting with "TAG".
  if (out.length > 128 && out.toString('latin1', out.length - 128, out.length - 125) === 'TAG') {
    out = out.subarray(0, out.length - 128);
  }
  return out;
}

// The full story as one MP3, or null when not every page is narrated yet
// (a half audiobook is worse than none) or the narration isn't MP3.
export async function buildFullStoryMp3(bookId: string, pageCount: number): Promise<Buffer | null> {
  const narrations = await latestNarrations(bookId);
  if (narrations.length < pageCount) return null;
  if (narrations.some((n) => n.mimeType && !/mpeg|mp3/i.test(n.mimeType))) return null;
  const parts: Buffer[] = [];
  for (const narration of narrations) {
    try {
      parts.push(stripId3(await readBookAsset(narration.artifactKey!)));
    } catch {
      return null;
    }
  }
  return Buffer.concat(parts);
}

// ASCII-only file name for Content-Disposition plus the UTF-8 one (RFC 5987)
// so Georgian titles survive the download.
export function attachmentHeader(title: string, extension: string): string {
  const ascii = title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'book';
  return `attachment; filename="${ascii}.${extension}"; filename*=UTF-8''${encodeURIComponent(`${title.trim() || 'book'}.${extension}`)}`;
}
