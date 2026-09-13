import path from 'path';
import crypto from 'crypto';
import { uploadPrivateBlob, getSignedBlobUrl } from './privateBlobStorage';

// ============================================================
// Assignment submission file delivery — AssignmentSubmission.fileUrl
// historically stored a permanent, unauthenticated Bunny CDN URL for a
// student's own homework upload. Same fix as verificationDocDelivery.ts/
// productFileDelivery.ts: upload through the existing private Azure Blob
// container and store a `cdcblob://<blobName>` marker instead of a real
// URL — the actual file is resolved on demand, short-lived, only for the
// submission's own owner or an admin reviewing/grading it (see
// routes/courses.ts's GET .../submissions/mine and GET /admin/submissions).
//
// Legacy rows keep whatever Bunny URL they already had —
// resolveAssignmentSubmissionDeliveryUrl() passes anything that isn't one
// of our markers through unchanged. No historical backfill here.
// ============================================================

const MARKER_SCHEME = 'cdcblob://';
const DOWNLOAD_SAS_EXPIRY_MINUTES = 15;
// Exactly what uploadAssignmentSubmissionFile() below generates:
// assignment-submissions/<userId>/<lessonId>/<uuid>.<ext>. Both userId and
// lessonId are sanitized to a safe path-segment charset before being used
// as blob-name components (lessonId in particular arrives as a raw URL
// param, not something already known-safe).
const SUBMISSION_BLOB_NAME_PATTERN = /^assignment-submissions\/[a-zA-Z0-9._-]{1,100}\/[a-zA-Z0-9._-]{1,100}\/[0-9a-f-]{36}(?:\.[a-zA-Z0-9]+)?$/;

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function isPrivateSubmissionRef(url: string): boolean {
  return url.startsWith(MARKER_SCHEME) && SUBMISSION_BLOB_NAME_PATTERN.test(url.slice(MARKER_SCHEME.length));
}

export async function uploadAssignmentSubmissionFile(userId: string, lessonId: string, buffer: Buffer, mimetype: string, originalFilename: string): Promise<string> {
  const blobName = `assignment-submissions/${sanitizePathSegment(userId)}/${sanitizePathSegment(lessonId)}/${crypto.randomUUID()}${path.extname(originalFilename)}`;
  await uploadPrivateBlob(blobName, buffer, mimetype);
  return `${MARKER_SCHEME}${blobName}`;
}

// Called only after the caller has already been authorized (the
// submission's own owner, or an admin) — never cache or persist this
// return value, it expires in DOWNLOAD_SAS_EXPIRY_MINUTES.
export async function resolveAssignmentSubmissionDeliveryUrl(url: string): Promise<string> {
  if (!isPrivateSubmissionRef(url)) return url;
  return getSignedBlobUrl(url.slice(MARKER_SCHEME.length), DOWNLOAD_SAS_EXPIRY_MINUTES);
}
