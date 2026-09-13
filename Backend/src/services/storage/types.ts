// ============================================================
// IAKO / CDC storage abstraction — Phase A (architecture only).
//
// Feature modules describe WHAT they store (a logical StorageSpace)
// and never WHERE it lives (Bunny zone, Azure container, local path).
// Provider choice is resolved in config.ts; existing services
// (bunnyStorage.ts, privateBlobStorage.ts, imageStorage.ts's local
// fallback) remain the real implementations behind the adapters —
// Phase A routes nothing away from its current provider, so every
// existing URL/behavior is byte-for-byte unchanged.
// ============================================================

export type StorageProvider = 'bunny' | 'azure-blob' | 'local';

// Logical spaces — the ONLY vocabulary feature code is allowed to use.
// Each space is mapped to a concrete provider + visibility + prefix in
// config.ts. Adding a space (e.g. a future 'generated-assets') is a
// config edit, never a feature-code edit.
export type StorageSpace =
  | 'public-images'     // avatars, blog/course/team covers, CMS images — public CDN URLs (today: Bunny)
  | 'product-files'     // purchased Digital Store assets — private, short-lived signed URLs (today: Azure private blob)
  | 'product-videos'    // product preview videos — public URLs (today: Bunny via imageStorage)
  | 'training-assets'   // trainer videos, Live Training media, Daily Guide materials (today: Bunny via imageStorage)
  | 'private-media'     // lesson videos, IAKO screenshots — private + SAS (today: Azure private blob)
  | 'generated-assets'; // generated PDFs/documents — private (reserved; not yet written through this layer)

export interface StorageVisibility {
  public: boolean;
}

export interface UploadObject {
  key: string;             // provider-neutral logical key (e.g. "avatars/img.webp")
  url: string;             // what callers persist to the DB (public URL, cdcblob:// marker, or signed URL)
  provider: StorageProvider;
  space: StorageSpace;
}

export interface UploadInput {
  buffer: Buffer;
  contentType: string;
  // Caller-supplied filename/folder. Adapters sanitize per provider —
  // feature code never handles raw filesystem/URL escaping itself.
  filename: string;
  folder?: string;
}

export interface AuthorizedDownload {
  url: string;             // short-lived signed URL where supported
  expiresInMinutes: number;
}

export interface StorageAdapter {
  readonly provider: StorageProvider;
  // Persist an object; returns the URL/value callers store in the DB.
  upload(space: StorageSpace, input: UploadInput): Promise<UploadObject>;
  // Best-effort delete — must never throw for "not found" / unmanaged keys.
  delete(space: StorageSpace, key: string): Promise<void>;
  // Delete only if the URL actually belongs to this provider (guards against
  // deleting arbitrary external URLs). No-op on anything unmanaged.
  deleteIfManaged(space: StorageSpace, url: string | null | undefined): Promise<void>;
  // Stable public URL for public spaces. Throws for private-only spaces
  // (use getAuthorizedDownload instead).
  getPublicUrl(space: StorageSpace, key: string): string;
  // Short-lived authorized download for private spaces. Throws for
  // public-only spaces (there is nothing to sign — just use getPublicUrl).
  getAuthorizedDownload(space: StorageSpace, key: string, expiryMinutes?: number): Promise<AuthorizedDownload>;
  exists(space: StorageSpace, key: string): Promise<boolean>;
  // URL-based existence check (some providers only have the URL persisted,
  // e.g. Bunny CDN URLs in existing DB rows).
  urlIsManaged(space: StorageSpace, url: string | null | undefined): boolean;
}

export class StorageNotConfiguredError extends Error {
  constructor(provider: StorageProvider, message?: string) {
    super(message ?? `Storage provider "${provider}" is not configured.`);
    this.name = 'StorageNotConfiguredError';
  }
}

export class StorageUploadError extends Error {
  constructor(provider: StorageProvider, message: string) {
    super(`[${provider}] ${message}`);
    this.name = 'StorageUploadError';
  }
}

export class WrongSpaceVisibilityError extends Error {
  constructor(space: StorageSpace, operation: 'getPublicUrl' | 'getAuthorizedDownload' | 'upload') {
    super(`Operation ${operation} is not valid for space "${space}".`);
    this.name = 'WrongSpaceVisibilityError';
  }
}
