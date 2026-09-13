import fs from 'fs/promises';
import path from 'path';
import { BACKEND_URL } from '../../utils/env';
import { StorageAdapter, StorageSpace, UploadInput, UploadObject, AuthorizedDownload, WrongSpaceVisibilityError } from './types';
import { getSpaceConfig, isPublicSpace } from './config';

// ============================================================
// Local filesystem adapter — wraps the EXISTING imageStorage.ts local
// fallback path (Backend/public/uploads, served at BACKEND_URL/uploads).
//
// Phase A does NOT route anything new here and does NOT migrate any
// files; this adapter exists so the abstraction is complete and so a
// dev environment without Bunny/Azure keeps working when feature code
// switches to the facade. Same URL shape as today:
//   `${BACKEND_URL}/uploads/<folder>/<filename>`
// ============================================================

export const LOCAL_UPLOADS_ROOT = path.join(__dirname, '..', '..', '..', 'public', 'uploads');

function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = 'local' as const;

  async upload(space: StorageSpace, input: UploadInput): Promise<UploadObject> {
    if (!isPublicSpace(space)) {
      // Private content on local disk has no access control beyond the
      // static /uploads mount — refuse it in Phase A rather than create a
      // silent security hole.
      throw new WrongSpaceVisibilityError(space, 'upload');
    }
    const folder = sanitizePathSegment(input.folder ?? getSpaceConfig(space).defaultFolder ?? 'images');
    const filename = sanitizePathSegment(input.filename);
    const dir = path.join(LOCAL_UPLOADS_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), input.buffer);
    const key = `${folder}/${filename}`;
    return { key, url: this.getPublicUrl(space, key), provider: this.provider, space };
  }

  async delete(_space: StorageSpace, key: string): Promise<void> {
    const [folder, filename] = key.split('/');
    if (!folder || !filename || key.includes('..')) return;
    await fs.unlink(path.join(LOCAL_UPLOADS_ROOT, folder, filename)).catch(() => { });
  }

  async deleteIfManaged(_space: StorageSpace, url: string | null | undefined): Promise<void> {
    if (!url || !this.urlIsManaged(_space, url)) return;
    const prefix = `${BACKEND_URL}/uploads/`;
    const relative = url.slice(prefix.length);
    if (!relative || relative.includes('..')) return;
    await fs.unlink(path.join(LOCAL_UPLOADS_ROOT, relative)).catch(() => { });
  }

  getPublicUrl(_space: StorageSpace, key: string): string {
    if (!isPublicSpace(_space)) throw new WrongSpaceVisibilityError(_space, 'getPublicUrl');
    return `${BACKEND_URL}/uploads/${key}`;
  }

  async getAuthorizedDownload(space: StorageSpace, _key: string, _expiryMinutes?: number): Promise<AuthorizedDownload> {
    throw new WrongSpaceVisibilityError(space, 'getAuthorizedDownload');
  }

  async exists(_space: StorageSpace, key: string): Promise<boolean> {
    const [folder, filename] = key.split('/');
    if (!folder || !filename || key.includes('..')) return false;
    return fs.access(path.join(LOCAL_UPLOADS_ROOT, folder, filename)).then(() => true, () => false);
  }

  urlIsManaged(_space: StorageSpace, url: string | null | undefined): boolean {
    return !!url && url.startsWith(`${BACKEND_URL}/uploads/`);
  }
}
