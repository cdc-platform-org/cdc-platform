import fs from 'fs/promises';
import path from 'path';
import { execFileSync } from 'child_process';
import { z } from 'zod';
import { callTextModel, AiAgentError } from './aiAgentService';
import { isAiTranslateConfigured } from './aiTranslateService';

// ============================================================
// AI I18N TRANSLATION AGENT — scans Frontend/public/locales/{locale}/*.json
// against the `en` reference (same source-of-truth choice as scripts/
// check-locale-parity.js) for missing or empty string keys, drafts real
// translations via Gemini (reusing aiAgentService.callTextModel(), the same
// path aiTranslateService.ts's admin "Auto-Translate" buttons already use),
// and patches the files.
//
// Deliberately does NOT commit to `main` or push anywhere. It stages the
// patch on a brand-new local branch (`i18n-agent/auto-patch-<timestamp>`)
// and leaves it there — same "produce a reviewable artifact, never
// auto-deploy" posture as this repo's existing qa-autofix job (see
// .github/workflows/qa-nightly.yml's `autofix` job, which opens a draft PR
// rather than pushing straight to main). Actually opening a GitHub PR from
// here would need a GitHub PAT / GitHub App installation token with
// contents:write + pull-requests:write scope — no such credential exists in
// this environment today (only GITHUB_CLIENT_ID/SECRET, which is an OAuth
// *login* app's credentials and cannot create PRs). A human with real push
// access reviews the branch's diff and opens the PR themselves; wiring a
// real GitHub API call is a separate follow-up once that credential exists.
// ============================================================

const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_LOCALES_DIR = path.join(REPO_ROOT, 'Frontend', 'public', 'locales');
const SOURCE_LOCALE = 'en';

export class I18nAgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'I18nAgentError';
  }
}

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

function isPlainObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Recursively lists every leaf path in an object, e.g. {a: {b: 'x'}} -> ['a.b'].
// Mirrors check-locale-parity.js's flattenKeys() exactly, so "missing" here
// means the same thing that script already gates CI on.
function flattenKeys(obj: JsonObject, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (isPlainObject(value)) {
      keys = keys.concat(flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getAtPath(obj: JsonObject, dotPath: string): JsonValue | undefined {
  let current: JsonValue = obj;
  for (const segment of dotPath.split('.')) {
    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

// Mutates `obj` in place, creating intermediate objects as needed.
function setAtPath(obj: JsonObject, dotPath: string, value: JsonValue): void {
  const segments = dotPath.split('.');
  let current: JsonObject = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (!isPlainObject(current[segment])) current[segment] = {};
    current = current[segment] as JsonObject;
  }
  current[segments[segments.length - 1]] = value;
}

async function readJsonFile(filePath: string): Promise<JsonObject> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch (err: any) {
    if (err?.code === 'ENOENT') return {};
    throw new I18nAgentError(`Failed to read/parse ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function writeJsonFile(filePath: string, data: JsonObject): Promise<void> {
  // 2-space indent + trailing newline — matches every existing locale file's
  // own formatting (see public/locales/*/marketplace.json).
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export interface MissingKeyGroup {
  locale: string;
  namespace: string;
  // key -> the reference (en) string to translate from.
  missingStringKeys: Record<string, string>;
  // Keys present in en/ but absent here whose en/ value isn't a plain
  // string (an array, e.g. HRSupportRequestModal-style scopeItems lists, or
  // a number) — these need a human/manual translation pass, the agent
  // never guesses at array-shaped content.
  skippedNonStringKeys: string[];
}

// Scans every namespace for every non-`en` locale directory found under
// localesDir, returning one group per (locale, namespace) pair that has at
// least one missing or empty-string key. A locale/namespace with full
// parity is simply absent from the result — this is expected to often
// return an empty array on this codebase, since check:locales already
// enforces full key parity in CI; the agent exists to catch future drift,
// not because a known backlog exists today.
export async function scanMissingTranslations(localesDir: string = DEFAULT_LOCALES_DIR): Promise<MissingKeyGroup[]> {
  const sourceDir = path.join(localesDir, SOURCE_LOCALE);
  let namespaceFiles: string[];
  try {
    namespaceFiles = (await fs.readdir(sourceDir)).filter((f) => f.endsWith('.json'));
  } catch {
    throw new I18nAgentError(`Reference locale directory not found: ${sourceDir}`);
  }

  const localeDirs = (await fs.readdir(localesDir, { withFileTypes: true }))
    // Excludes dotfolders (e.g. a `.git` directory, which a test fixture
    // repo — or in principle any tooling — could create directly inside a
    // locales directory) so they're never mistaken for a locale needing a
    // full translation.
    .filter((entry) => entry.isDirectory() && entry.name !== SOURCE_LOCALE && !entry.name.startsWith('.'))
    .map((entry) => entry.name);

  const groups: MissingKeyGroup[] = [];

  for (const namespace of namespaceFiles) {
    const sourceJson = await readJsonFile(path.join(sourceDir, namespace));
    const sourceKeys = flattenKeys(sourceJson);

    for (const locale of localeDirs) {
      const targetPath = path.join(localesDir, locale, namespace);
      const targetJson = await readJsonFile(targetPath);

      const missingStringKeys: Record<string, string> = {};
      const skippedNonStringKeys: string[] = [];

      for (const key of sourceKeys) {
        const targetValue = getAtPath(targetJson, key);
        const isMissingOrEmpty = targetValue === undefined || targetValue === '';
        if (!isMissingOrEmpty) continue;

        const sourceValue = getAtPath(sourceJson, key);
        if (typeof sourceValue === 'string' && sourceValue.trim() !== '') {
          missingStringKeys[key] = sourceValue;
        } else {
          skippedNonStringKeys.push(key);
        }
      }

      if (Object.keys(missingStringKeys).length > 0 || skippedNonStringKeys.length > 0) {
        groups.push({ locale, namespace, missingStringKeys, skippedNonStringKeys });
      }
    }
  }

  return groups;
}

const translationBatchSchema = z.record(z.string(), z.string());

// One Gemini call per (locale, namespace) group — batches every missing key
// in that group into a single request (cheaper and keeps sibling strings in
// a form/modal contextually consistent, same reasoning as aiTranslateService
// .translateBlogPost's own single-call-for-multiple-fields comment).
export async function translateMissingKeys(
  group: Pick<MissingKeyGroup, 'locale' | 'namespace' | 'missingStringKeys'>
): Promise<Record<string, string>> {
  const entries = Object.entries(group.missingStringKeys);
  if (entries.length === 0) return {};

  const prompt = `You are translating UI copy for a real production web app (CDC platform) from English into the language with locale code "${group.locale}". These strings come from the "${group.namespace}" section of the site. Keep translations natural, concise, and appropriate for real UI (buttons, labels, form fields, error messages) — not literal word-for-word translation. Preserve any {{placeholder}} interpolation tokens, HTML tags, and emoji exactly as written; never translate or remove them. Respond with strict JSON: a flat object mapping each input key to its translated string, using exactly the same keys as the input, no extra keys, no commentary.

Input (key -> English source text):
${JSON.stringify(Object.fromEntries(entries), null, 2)}`;

  let raw: string;
  try {
    raw = await callTextModel(prompt, 0.3);
  } catch (err) {
    if (err instanceof AiAgentError) throw new I18nAgentError(`Gemini call failed for ${group.locale}/${group.namespace}: ${err.message}`);
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new I18nAgentError(`Gemini returned malformed JSON for ${group.locale}/${group.namespace}.`);
  }

  const result = translationBatchSchema.safeParse(parsed);
  if (!result.success) {
    throw new I18nAgentError(`Gemini returned an unexpected translation shape for ${group.locale}/${group.namespace}.`);
  }

  // Only keep keys we actually asked for — a model that "helpfully" adds
  // extra keys should never silently introduce untracked content.
  const requestedKeys = new Set(entries.map(([k]) => k));
  return Object.fromEntries(Object.entries(result.data).filter(([k]) => requestedKeys.has(k)));
}

// Patches one locale/namespace file in place with the given translations —
// merges into the EXISTING file content (read-modify-write), never
// overwrites keys that weren't part of this patch, so a concurrent manual
// edit to the same file can't be clobbered by a stale in-memory copy.
export async function patchLocaleFile(
  localesDir: string,
  locale: string,
  namespace: string,
  translations: Record<string, string>
): Promise<void> {
  if (Object.keys(translations).length === 0) return;
  const filePath = path.join(localesDir, locale, namespace);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const current = await readJsonFile(filePath);
  for (const [key, value] of Object.entries(translations)) {
    setAtPath(current, key, value);
  }
  await writeJsonFile(filePath, current);
}

export interface I18nAgentRunResult {
  configured: boolean;
  patchedGroups: { locale: string; namespace: string; keysPatched: number }[];
  skippedNonStringKeys: { locale: string; namespace: string; key: string }[];
  totalKeysPatched: number;
  validationPassed: boolean | null; // null when nothing was patched (nothing to validate)
  gitBranch: string | null;
  message: string;
}

// Re-runs the same key-parity comparison check-locale-parity.js does, purely
// in-process (no git status), so the agent can self-verify its own patch
// before reporting success — same spec requirement as "Run npm run
// check:locales validation script" from the feature request, just invoked
// as a function here instead of shelling out to the script.
async function validateParity(localesDir: string): Promise<boolean> {
  const groups = await scanMissingTranslations(localesDir);
  // Only missingStringKeys count as a real parity failure — a
  // skippedNonStringKeys entry is a known, flagged gap (an array-shaped
  // value the agent deliberately never touches), not something this patch
  // pass was ever supposed to close.
  return groups.every((g) => Object.keys(g.missingStringKeys).length === 0);
}

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

// Commits the patched locale files to a brand-new local branch, then
// switches back to whatever branch was checked out before this ran — so a
// call to this function never changes what the working tree has checked
// out from the caller's point of view, it only adds a new branch pointer
// with one commit on it. Never pushes, never touches main. Returns the new
// branch name, or null if there was nothing to commit.
//
// The repo root is resolved from `localesDir` itself (via `git rev-parse
// --show-toplevel`, run with that directory as cwd) rather than a hardcoded
// path — critical for test isolation: a test pointing localesDir at a
// disposable fixture repo must never have this function reach into the real
// project repo instead and create branches/commits there.
async function commitPatchToNewBranch(localesDir: string, patchedFiles: string[]): Promise<string | null> {
  if (patchedFiles.length === 0) return null;
  const repoRoot = runGit(['rev-parse', '--show-toplevel'], localesDir);
  const originalBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  const branchName = `i18n-agent/auto-patch-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try {
    runGit(['checkout', '-b', branchName], repoRoot);
    // Scoped to exactly the files this run patched — never a blanket `git
    // add -A`, so nothing else in a dirty working tree gets swept in. Passed
    // as absolute paths (git accepts these directly) rather than relativized
    // against repoRoot — a short-path (8.3) vs. resolved-long-path mismatch
    // between os.tmpdir() and git's own toplevel resolution made
    // path.relative() compute garbage relative paths on Windows.
    runGit(['add', ...patchedFiles], repoRoot);
    runGit(['commit', '-m', 'chore(i18n): Auto-patched missing locale translations via AI Agent'], repoRoot);
    return branchName;
  } finally {
    runGit(['checkout', originalBranch], repoRoot);
  }
}

export interface RunI18nAgentOptions {
  localesDir?: string;
  // Test/preview hook — computes everything (including what WOULD be
  // written) but skips both the file writes and the git branch/commit.
  dryRun?: boolean;
}

export async function runI18nAutoTranslateAgent(options: RunI18nAgentOptions = {}): Promise<I18nAgentRunResult> {
  const localesDir = options.localesDir ?? DEFAULT_LOCALES_DIR;

  if (!isAiTranslateConfigured()) {
    return {
      configured: false,
      patchedGroups: [],
      skippedNonStringKeys: [],
      totalKeysPatched: 0,
      validationPassed: null,
      gitBranch: null,
      message: 'Gemini is not configured (GEMINI_API_KEY missing) — nothing was scanned or patched.',
    };
  }

  const groups = await scanMissingTranslations(localesDir);
  const skippedNonStringKeys = groups.flatMap((g) =>
    g.skippedNonStringKeys.map((key) => ({ locale: g.locale, namespace: g.namespace, key }))
  );

  if (groups.every((g) => Object.keys(g.missingStringKeys).length === 0)) {
    return {
      configured: true,
      patchedGroups: [],
      skippedNonStringKeys,
      totalKeysPatched: 0,
      validationPassed: true,
      gitBranch: null,
      message:
        skippedNonStringKeys.length > 0
          ? `No translatable string gaps found — all locales already have real key parity. ${skippedNonStringKeys.length} non-string key(s) across locales need manual review (arrays/numbers the agent never auto-translates).`
          : 'No translation gaps found — all locales already have real key parity.',
    };
  }

  const patchedGroups: I18nAgentRunResult['patchedGroups'] = [];
  const patchedFiles: string[] = [];
  let totalKeysPatched = 0;

  for (const group of groups) {
    if (Object.keys(group.missingStringKeys).length === 0) continue;
    const translations = await translateMissingKeys(group);
    if (Object.keys(translations).length === 0) continue;

    if (!options.dryRun) {
      await patchLocaleFile(localesDir, group.locale, group.namespace, translations);
    }
    patchedFiles.push(path.join(localesDir, group.locale, group.namespace));
    patchedGroups.push({ locale: group.locale, namespace: group.namespace, keysPatched: Object.keys(translations).length });
    totalKeysPatched += Object.keys(translations).length;
  }

  if (options.dryRun) {
    return {
      configured: true,
      patchedGroups,
      skippedNonStringKeys,
      totalKeysPatched,
      validationPassed: null,
      gitBranch: null,
      message: `Dry run — would patch ${totalKeysPatched} key(s) across ${patchedGroups.length} locale/namespace file(s). No files written, no branch created.`,
    };
  }

  const validationPassed = await validateParity(localesDir);
  const gitBranch = await commitPatchToNewBranch(localesDir, patchedFiles);

  return {
    configured: true,
    patchedGroups,
    skippedNonStringKeys,
    totalKeysPatched,
    validationPassed,
    gitBranch,
    message: gitBranch
      ? `Patched ${totalKeysPatched} key(s) across ${patchedGroups.length} file(s) and committed them to new branch "${gitBranch}" (not pushed — review the diff and push/open a PR yourself; this environment has no GitHub token with PR-creation scope).`
      : `Patched ${totalKeysPatched} key(s) across ${patchedGroups.length} file(s), but the git commit step was skipped (no patched files reached disk).`,
  };
}
