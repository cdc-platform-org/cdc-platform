// Upload endpoints (products.ts/adminProducts.ts) return a full storage URL
// like `.../product-files/product-171234-<uuid>.zip` — this pulls out just
// the trailing segment so FileDropzone can show something readable ("Uploaded
// ✓ product-...zip") instead of the whole URL.
export function assetFilenameFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    const last = pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    const last = url.split('/').filter(Boolean).pop();
    return last ?? null;
  }
}
