// Derives a short display label ("ZIP", "PDF", "MP4"...) from a product's
// fileUrl extension — safe to expose publicly (products.ts/adminProducts.ts)
// even though fileUrl itself never is, since the extension alone reveals
// nothing about where the asset is actually hosted.
export function fileFormatFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(url);
  return match ? match[1].toUpperCase() : null;
}

// Last path segment of a stored file url ("cdcblob://product-file-….zip" or
// a plain URL) — the display-name fallback for rows saved before
// DigitalProduct.fileName existed.
export function fileNameFromUrl(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0];
  const last = withoutQuery.split('/').filter(Boolean).pop();
  try {
    return last ? decodeURIComponent(last) : 'file';
  } catch {
    return last ?? 'file';
  }
}

export interface ProductFileEntry {
  url: string;
  name: string;
}

// DigitalProduct.additionalFiles is a Json column — written only through
// adminProducts.ts's zod-validated routes, but read defensively anyway so a
// hand-edited row can't crash the download route.
export function parseAdditionalFiles(value: unknown): ProductFileEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const { url, name } = entry as Record<string, unknown>;
    if (typeof url !== 'string' || !url) return [];
    return [{ url, name: typeof name === 'string' && name ? name : fileNameFromUrl(url) }];
  });
}
