// CLI: audits Frontend/public/locales/<lang>/*.json against the en/ source
// of truth and (unless --check) patches missing/empty string values via
// Gemini (aiTranslateService.translateLocaleBatch). Companion to
// Frontend/scripts/check-locale-parity.js, which only verifies KEY parity —
// this is the tool that keeps target-locale VALUES in sync when an English
// string is added/edited and no translator is on hand yet. Never rewrites a
// key that's already non-empty and different from the English source, so a
// clean run produces a zero-diff (or near-zero) patch, not a full rewrite.
//
// Usage (run from Backend/, via `npm run translate:locales` — see
// package.json):
//   ts-node scripts/auto-translate-locales.ts [--check] [--langs=de,es] [--include-identical]
//
// --check             report what would change, make no API calls, no writes.
//                      Exits 1 if anything is out of sync (usable as a gate).
// --langs=a,b,c        restrict to a subset of target locales (default: all).
// --include-identical  also flag/patch a target value that is byte-identical
//                      to the English source (a common English-fallback
//                      placeholder pattern) as needing translation. Off by
//                      default since some values are legitimately identical
//                      (brand names, acronyms) and this heuristic can't tell
//                      the difference — use with a manual diff review.
//
// Used by .github/workflows/i18n-auto-sync.yml for the scheduled run.
import fs from 'fs';
import path from 'path';
import {
  isAiTranslateConfigured,
  translateLocaleBatch,
  AiTranslateError,
} from '../src/services/aiTranslateService';

const LOCALES_DIR = path.resolve(__dirname, '../../Frontend/public/locales');
const SOURCE_LOCALE = 'en';
const ALL_TARGET_LOCALES = ['de', 'es', 'fr', 'uk', 'tr', 'hy', 'az'];

// Namespaces carrying payment/legal/certificate-adjacent copy. Translated
// like everything else here (not skipped) but called out in the run
// summary so a human reviewing the resulting PR knows exactly where to
// look first — this codebase's i18n history has repeatedly treated this
// class of copy with extra scrutiny (see billing/settings i18n notes in
// prior session write-ups).
const REVIEW_FLAGGED_NAMESPACES = new Set(['billing', 'settings']);

type Json = Record<string, unknown>;

interface Args {
  check: boolean;
  langs: string[];
  includeIdentical: boolean;
}

function parseArgs(argv: string[]): Args {
  const check = argv.includes('--check') || argv.includes('--dry-run');
  const includeIdentical = argv.includes('--include-identical');
  const langsArg = argv.find((a) => a.startsWith('--langs='));
  const langs = langsArg
    ? langsArg
        .slice('--langs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ALL_TARGET_LOCALES;
  for (const l of langs) {
    if (!ALL_TARGET_LOCALES.includes(l)) {
      console.error(`Unknown target locale "${l}". Valid: ${ALL_TARGET_LOCALES.join(', ')}`);
      process.exit(2);
    }
  }
  return { check, langs, includeIdentical };
}

function readJson(filePath: string): Json {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath: string, data: Json): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Only string leaves are in scope for translation — a non-string leaf
// (number/boolean/array) is left to a human, never auto-patched.
function flattenStringLeaves(obj: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of flattenStringLeaves(value as Json, fullKey)) out.set(k, v);
    } else if (typeof value === 'string') {
      out.set(fullKey, value);
    }
  }
  return out;
}

function setAtPath(obj: Json, dotPath: string, value: string): void {
  const parts = dotPath.split('.');
  let cur: Json = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cur[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Json;
  }
  cur[parts[parts.length - 1]] = value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const sourceDir = path.join(LOCALES_DIR, SOURCE_LOCALE);
  const namespaces = fs
    .readdirSync(sourceDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  let totalIssues = 0;
  let hadFailure = false;
  const patchedFiles = new Set<string>();

  for (const namespace of namespaces) {
    const sourceObj = readJson(path.join(sourceDir, namespace));
    const sourceLeaves = flattenStringLeaves(sourceObj);
    const nsLabel = namespace.replace(/\.json$/, '');

    for (const locale of args.langs) {
      const targetPath = path.join(LOCALES_DIR, locale, namespace);
      const targetObj: Json = fs.existsSync(targetPath) ? readJson(targetPath) : {};
      const targetLeaves = flattenStringLeaves(targetObj);

      const toTranslate: Record<string, string> = {};
      for (const [key, sourceValue] of sourceLeaves) {
        const targetValue = targetLeaves.get(key);
        const isMissing = targetValue === undefined;
        const isEmpty = targetValue === '';
        const isIdentical =
          args.includeIdentical && targetValue === sourceValue && sourceValue.trim().length > 0;
        if (isMissing || isEmpty || isIdentical) {
          toTranslate[key] = sourceValue;
        }
      }

      const count = Object.keys(toTranslate).length;
      if (count === 0) continue;

      totalIssues += count;
      const flag = REVIEW_FLAGGED_NAMESPACES.has(nsLabel)
        ? '  ⚠ payment/legal-adjacent namespace — flag for native review'
        : '';
      console.log(`${args.check ? '[check]' : '[patch]'} ${locale}/${namespace}: ${count} string(s)${flag}`);
      for (const key of Object.keys(toTranslate)) console.log(`    - ${key}`);

      if (args.check) continue;

      if (!isAiTranslateConfigured()) {
        console.error(`  ✖ GEMINI_API_KEY not configured — cannot patch ${locale}/${namespace}`);
        hadFailure = true;
        continue;
      }

      try {
        const translated = await translateLocaleBatch(toTranslate, locale);
        for (const [key, value] of Object.entries(translated)) {
          setAtPath(targetObj, key, value);
        }
        writeJson(targetPath, targetObj);
        patchedFiles.add(targetPath);
        console.log(`  ✓ patched ${locale}/${namespace}`);
      } catch (err) {
        hadFailure = true;
        const message = err instanceof AiTranslateError ? err.message : err instanceof Error ? err.message : String(err);
        console.error(`  ✖ failed to translate ${locale}/${namespace}: ${message}`);
      }
    }
  }

  console.log('');
  if (totalIssues === 0) {
    console.log('✓ No missing/empty locale strings found — nothing to do.');
    process.exit(0);
  }

  if (args.check) {
    console.log(`${totalIssues} string(s) across ${namespaces.length} namespace(s) need translation.`);
    process.exit(1);
  }

  console.log(`Patched ${patchedFiles.size} file(s), ${totalIssues} string(s) total.`);
  process.exit(hadFailure ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
