#!/usr/bin/env node
// Guards against exactly the class of bug a manual i18n rollout invites:
// a key added to en/<namespace>.json (or edited into a nested object) that
// never makes it into one of the other locale files, which next-i18next
// then silently renders as the raw key string ("courses:tabAll") instead
// of real text — no build error, no lint warning, just broken-looking copy
// that only shows up by actually clicking through every locale by hand.
//
// Compares every locale's namespace files against the same namespace in
// en/ (the language every rollout in this codebase's history has used as
// the source of truth) — deep/recursive, not just top-level keys, since
// several namespaces (auth.json, proposals.json, mentorship.json) nest
// objects several levels deep (login.title, feeCalculator.tooltip, ...).
// Run via `pnpm run check:locales` — exits non-zero on any mismatch so CI
// can gate on it the same way it already gates on lint.
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SOURCE_LOCALE = 'en';

function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const locales = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const sourceDir = path.join(LOCALES_DIR, SOURCE_LOCALE);
const namespaces = fs
  .readdirSync(sourceDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

let hasMismatch = false;

for (const namespace of namespaces) {
  const sourceKeys = flattenKeys(readJson(path.join(sourceDir, namespace)));

  for (const locale of locales) {
    if (locale === SOURCE_LOCALE) continue;
    const targetPath = path.join(LOCALES_DIR, locale, namespace);
    if (!fs.existsSync(targetPath)) {
      hasMismatch = true;
      console.error(`✖ ${locale}/${namespace} does not exist (source has ${sourceKeys.length} keys)`);
      continue;
    }
    const targetKeys = flattenKeys(readJson(targetPath));
    const missing = sourceKeys.filter((k) => !targetKeys.includes(k));
    const extra = targetKeys.filter((k) => !sourceKeys.includes(k));
    if (missing.length > 0 || extra.length > 0) {
      hasMismatch = true;
      console.error(`✖ ${locale}/${namespace}`);
      if (missing.length > 0) console.error(`    missing: ${missing.join(', ')}`);
      if (extra.length > 0) console.error(`    extra:   ${extra.join(', ')}`);
    }
  }
}

if (hasMismatch) {
  console.error('\nLocale key parity check failed — see mismatches above.');
  process.exit(1);
} else {
  console.log(`✓ All ${locales.length} locales have exact key parity with ${SOURCE_LOCALE}/ across ${namespaces.length} namespaces.`);
}
