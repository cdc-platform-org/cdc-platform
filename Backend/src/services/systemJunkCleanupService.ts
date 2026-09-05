import fs from 'fs/promises';
import path from 'path';

// ============================================================
// SYSTEM JUNK & TEMP CLEANUP — deletes only well-known, regenerable
// build/runtime artifacts under the backend's own root (process.cwd() at
// server start, i.e. Backend/ in this repo — this process never has the
// Frontend directory as a sibling in a real deployment, so it only ever
// cleans its own junk). Never touches source, config, migrations, or
// persistent user data — see PROTECTED_RELATIVE_PATHS/PROTECTED_FILE_NAME
// below for the hard exclusions.
// ============================================================

// Whole directories removed recursively, existence-checked first. Each path
// is a literal (no wildcards) relative to root, so there is no ambiguity
// about what gets deleted — every one of these is a build/test cache that
// regenerates itself on the next build/test run.
const JUNK_DIRECTORIES = ['.cache', 'node_modules/.cache', '.next/cache', 'dist/tmp', 'coverage'];

// Never descended into during the loose-junk-file scan below, regardless of
// depth — checked against the path relative to root, forward-slash
// normalized. node_modules/.git are excluded for performance and because
// they're either regenerable-in-bulk (handled via JUNK_DIRECTORIES for the
// one cache subfolder that matters) or not ours to touch; public/uploads is
// real user-uploaded content (see imageStorage.ts's local-disk fallback),
// never junk no matter what it's named.
const PROTECTED_RELATIVE_PATHS = new Set(['node_modules', '.git', 'public/uploads', 'prisma']);

// Loose files matched by name only (never by path substring) during the
// recursive scan — deliberately narrow to exactly what was asked for.
const JUNK_FILE_PATTERNS: RegExp[] = [/\.log$/i, /^npm-debug\.log/i, /\.tmp$/i, /\.temp$/i, /^\.DS_Store$/, /^Thumbs\.db$/i];

// Checked before JUNK_FILE_PATTERNS on every file, so a name that could ever
// collide with both (it can't today, but this is the one rule that must
// never lose a race with a future junk pattern change) always wins.
const PROTECTED_FILE_NAME = /^\.env/i;

export interface PurgeJunkResult {
  deletedFilesCount: number;
  freedBytes: number;
}

async function pathExists(target: string): Promise<boolean> {
  return fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
}

async function dirSizeAndCount(target: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  async function walk(dir: string) {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        try {
          const stat = await fs.stat(full);
          bytes += stat.size;
          files += 1;
        } catch {
          // File vanished mid-scan (e.g. a genuinely temp file) — not our
          // problem, it won't be counted or need deleting either way.
        }
      }
    }
  }
  await walk(target);
  return { bytes, files };
}

async function removeJunkDirectory(root: string, relPath: string): Promise<{ files: number; bytes: number }> {
  const target = path.join(root, relPath);
  // Defense-in-depth: relPath is always a hardcoded literal from
  // JUNK_DIRECTORIES above, never user input, but this guards against a
  // future edit accidentally introducing a value that escapes root.
  if (path.relative(root, target).startsWith('..')) return { files: 0, bytes: 0 };
  if (!(await pathExists(target))) return { files: 0, bytes: 0 };
  const { bytes, files } = await dirSizeAndCount(target);
  await fs.rm(target, { recursive: true, force: true });
  return { files, bytes };
}

// Recursively scans for loose junk FILES only — directories already fully
// handled by removeJunkDirectory are skipped here (they're gone by the time
// this runs) so nothing is double-counted or raced with the delete above.
async function scanAndDeleteJunkFiles(dir: string, root: string, stats: { files: number; bytes: number }) {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const relFromRoot = path.relative(root, full).replace(/\\/g, '/');
    if (PROTECTED_RELATIVE_PATHS.has(relFromRoot)) continue;

    if (entry.isDirectory()) {
      if (JUNK_DIRECTORIES.includes(relFromRoot)) continue; // already removed above
      await scanAndDeleteJunkFiles(full, root, stats);
      continue;
    }

    if (PROTECTED_FILE_NAME.test(entry.name)) continue;
    if (!JUNK_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))) continue;

    try {
      const stat = await fs.stat(full);
      await fs.unlink(full);
      stats.files += 1;
      stats.bytes += stat.size;
    } catch {
      // A permission error or the file vanishing mid-scan on a single entry
      // must not abort the rest of the purge — skip and keep going.
    }
  }
}

export async function purgeSystemJunk(): Promise<PurgeJunkResult> {
  const root = process.cwd();
  let deletedFilesCount = 0;
  let freedBytes = 0;

  for (const relDir of JUNK_DIRECTORIES) {
    const { files, bytes } = await removeJunkDirectory(root, relDir);
    deletedFilesCount += files;
    freedBytes += bytes;
  }

  const fileStats = { files: 0, bytes: 0 };
  await scanAndDeleteJunkFiles(root, root, fileStats);
  deletedFilesCount += fileStats.files;
  freedBytes += fileStats.bytes;

  return { deletedFilesCount, freedBytes };
}
