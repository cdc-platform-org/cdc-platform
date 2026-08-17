// Derives a short display label ("ZIP", "PDF", "MP4"...) from a product's
// fileUrl extension — safe to expose publicly (products.ts/adminProducts.ts)
// even though fileUrl itself never is, since the extension alone reveals
// nothing about where the asset is actually hosted.
export function fileFormatFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /\.([a-z0-9]+)(?:\?.*)?$/i.exec(url);
  return match ? match[1].toUpperCase() : null;
}
