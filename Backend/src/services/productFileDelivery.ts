import path from 'path';
import crypto from 'crypto';
import { uploadPrivateBlob, getSignedBlobUrl } from './privateBlobStorage';

// ============================================================
// Digital Store file delivery — DigitalProduct.fileUrl historically stored
// a permanent, unauthenticated Bunny CDN URL (see services/bunnyStorage.ts):
// anyone holding that URL could download the paid asset forever, purchase
// or not, since the purchase check only gated whether the API *handed the
// URL out*, not whether the URL itself worked. This module fixes that by
// uploading through /upload-file into the same private Azure Blob container
// routes/upload.ts already uses for lesson videos, and storing a stable
// `cdcblob://<blobName>` marker in fileUrl instead of a real URL — the
// actual downloadable link is only ever minted on demand, short-lived, by
// resolveProductFileDeliveryUrl(), from routes/products.ts's already-
// purchase-gated GET /:id/download.
//
// Pre-existing rows (or an admin who pasted an external URL directly rather
// than uploading through /upload-file) keep whatever URL they had —
// resolveProductFileDeliveryUrl() passes those through unchanged, same
// protection level as before this existed, not a regression.
// ============================================================

const MARKER_SCHEME = 'cdcblob://';
const DOWNLOAD_SAS_EXPIRY_MINUTES = 15;
// Exactly what uploadProductFile() below generates. fileUrl is admin/
// submitter-supplied input (Zod only checks `.url()`, not provenance), so a
// crafted `cdcblob://<arbitrary-string>` can't be handed straight to the
// Azure SDK as a blob name — resolveProductFileDeliveryUrl() falls back to
// treating anything that doesn't match this shape as an ordinary external
// URL instead of signing it.
const PRODUCT_FILE_BLOB_NAME_PATTERN = /^product-file-\d+-[0-9a-f-]{36}(?:\.[a-zA-Z0-9]+)?$/;

export function isPrivateProductFileRef(fileUrl: string): boolean {
  return fileUrl.startsWith(MARKER_SCHEME) && PRODUCT_FILE_BLOB_NAME_PATTERN.test(fileUrl.slice(MARKER_SCHEME.length));
}

// Uploads a purchasable asset to private storage and returns the marker to
// persist as DigitalProduct.fileUrl. Deliberately still satisfies Zod's
// `z.string().url()` check on the create/submit payload (a `scheme://host/
// path` string parses fine as a URL) so no schema change was needed on the
// submit/create routes — the marker only needs to round-trip from this
// upload response back into the same field.
export async function uploadProductFile(buffer: Buffer, mimetype: string, originalFilename: string): Promise<string> {
  const blobName = `product-file-${Date.now()}-${crypto.randomUUID()}${path.extname(originalFilename)}`;
  await uploadPrivateBlob(blobName, buffer, mimetype);
  return `${MARKER_SCHEME}${blobName}`;
}

// Turns a stored fileUrl into something actually fetchable right now. Called
// only after a completed-purchase check — never cache or persist this
// return value, it expires in DOWNLOAD_SAS_EXPIRY_MINUTES.
export async function resolveProductFileDeliveryUrl(fileUrl: string): Promise<string> {
  if (!isPrivateProductFileRef(fileUrl)) return fileUrl;
  const blobName = fileUrl.slice(MARKER_SCHEME.length);
  return getSignedBlobUrl(blobName, DOWNLOAD_SAS_EXPIRY_MINUTES);
}
