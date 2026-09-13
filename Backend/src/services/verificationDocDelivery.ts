import path from 'path';
import crypto from 'crypto';
import { uploadPrivateBlob, getSignedBlobUrl, deletePrivateBlob } from './privateBlobStorage';

// ============================================================
// Business KYC / individual ID verification document delivery.
//
// User.verificationDocUrl historically stored a permanent, unauthenticated
// Bunny CDN URL — a scanned ID card, passport, or business registration
// document sitting behind a plain public link. This module fixes that the
// same way productFileDelivery.ts already fixed the equivalent problem for
// Digital Store downloads: uploading through the existing private Azure
// Blob container (services/privateBlobStorage.ts) and storing a stable
// `cdcblob://<blobName>` marker in verificationDocUrl instead of a real
// URL — the actual document is only ever resolved on demand, short-lived,
// by an authorized caller (the owning user themselves, or an admin
// reviewing the submission).
//
// Legacy rows (or the rare admin-pasted external URL) keep whatever value
// they already had — resolveVerificationDocDeliveryUrl() passes anything
// that isn't one of our markers through unchanged, same "no regression for
// pre-existing data" posture as productFileDelivery.ts.
// ============================================================

const MARKER_SCHEME = 'cdcblob://';
const DOWNLOAD_SAS_EXPIRY_MINUTES = 15;
// Exactly what uploadVerificationDoc() below generates:
// verification-docs/<userId>/<uuid>.<ext>. verificationDocUrl is never
// re-validated as a URL shape elsewhere in this codebase, so a crafted
// `cdcblob://<arbitrary-string>` must not be handed straight to the Azure
// SDK as a blob name — resolveVerificationDocDeliveryUrl() falls back to
// treating anything that doesn't match this exact shape as an ordinary
// external URL instead of signing it. The userId segment is deliberately a
// bounded safe-character class, not a strict UUID regex, so this doesn't
// silently break if the User.id format ever changes.
const VERIFICATION_DOC_BLOB_NAME_PATTERN = /^verification-docs\/[a-zA-Z0-9_-]{1,100}\/[0-9a-f-]{36}(?:\.[a-zA-Z0-9]+)?$/;

export function isPrivateVerificationDocRef(url: string): boolean {
  return url.startsWith(MARKER_SCHEME) && VERIFICATION_DOC_BLOB_NAME_PATTERN.test(url.slice(MARKER_SCHEME.length));
}

// Uploads a verification document to private storage and returns the
// marker to persist as User.verificationDocUrl. Scoped under the owning
// user's own id so a blob name can never collide across users and every
// document's ownership is legible from its key alone.
export async function uploadVerificationDoc(userId: string, buffer: Buffer, mimetype: string, originalFilename: string): Promise<string> {
  const blobName = `verification-docs/${userId}/${crypto.randomUUID()}${path.extname(originalFilename)}`;
  await uploadPrivateBlob(blobName, buffer, mimetype);
  return `${MARKER_SCHEME}${blobName}`;
}

// Turns a stored verificationDocUrl into something actually fetchable right
// now. Called only after the caller has already been authorized (the
// document's own owner, or an admin with the right role) — never cache or
// persist this return value, it expires in DOWNLOAD_SAS_EXPIRY_MINUTES.
export async function resolveVerificationDocDeliveryUrl(url: string): Promise<string> {
  if (!isPrivateVerificationDocRef(url)) return url;
  const blobName = url.slice(MARKER_SCHEME.length);
  return getSignedBlobUrl(blobName, DOWNLOAD_SAS_EXPIRY_MINUTES);
}

// Best-effort cleanup of a REPLACED document — only ever deletes a blob
// that actually matches our own marker shape, so this safely no-ops on a
// legacy Bunny URL (that cleanup goes through deleteBunnyStorageUrlIfManaged
// instead) or any other value.
export async function deleteVerificationDocIfManaged(url: string | null | undefined): Promise<void> {
  if (!url || !isPrivateVerificationDocRef(url)) return;
  await deletePrivateBlob(url.slice(MARKER_SCHEME.length));
}
