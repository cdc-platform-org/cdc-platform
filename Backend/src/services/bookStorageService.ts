import fs from 'fs';
import path from 'path';
import { shouldUseCloudBookStorage } from './bookMockConfig';
import { uploadPrivateBlob, getSignedBlobUrl, deletePrivateBlob } from './privateBlobStorage';

// ============================================================
// Children's Book — storage abstraction. Production (and any environment
// that opts in via BOOK_USE_CLOUD_STORAGE) uses the existing private Azure
// Blob + short-lived SAS URL architecture (privateBlobStorage.ts) —
// nothing here reimplements that. Local development defaults to a
// gitignored on-disk fallback so the wizard can be built/QA'd without a
// working Managed Identity session on the developer's machine.
//
// Keys are always logical paths like "books/<bookProjectId>/final-v2.pdf"
// — identical shape in both backends — so callers never know which one is
// active.
// ============================================================

const LOCAL_STORAGE_ROOT = path.join(__dirname, '..', '..', 'local-storage', 'book-assets');

function localPathFor(key: string): string {
  const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
  return path.join(LOCAL_STORAGE_ROOT, safe);
}

export async function storeBookAsset(key: string, buffer: Buffer, mimetype: string): Promise<void> {
  if (shouldUseCloudBookStorage()) {
    await uploadPrivateBlob(key, buffer, mimetype);
    return;
  }
  const dest = localPathFor(key);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.writeFile(dest, buffer);
}

export async function deleteBookAsset(key: string): Promise<void> {
  if (shouldUseCloudBookStorage()) {
    await deletePrivateBlob(key);
    return;
  }
  await fs.promises.rm(localPathFor(key), { force: true }).catch(() => {});
}

// Real mode: a short-lived SAS URL the caller redirects to. Local mode:
// null — there is no URL to sign, so the download route streams the file
// directly instead (see routes/childrensBook.ts's download handler).
export async function getBookAssetUrl(key: string, expiryMinutes?: number): Promise<string | null> {
  if (shouldUseCloudBookStorage()) {
    return getSignedBlobUrl(key, expiryMinutes);
  }
  return null;
}

export async function readLocalBookAsset(key: string): Promise<Buffer> {
  return fs.promises.readFile(localPathFor(key));
}

export function isUsingCloudBookStorage(): boolean {
  return shouldUseCloudBookStorage();
}
