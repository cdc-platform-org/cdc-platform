#!/usr/bin/env node
// Admin panel Georgian coverage check. Every literal passed to at()/atf()
// in the admin pages/components must have a Georgian entry in
// src/i18n/admin/ka/*.ts (keyed by the English text — see
// src/i18n/admin/runtime.ts). Exits 1 and lists the missing keys otherwise.
//
//   node scripts/check-admin-i18n.js          # check
//   node scripts/check-admin-i18n.js --json   # print missing keys as JSON
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const SCAN_DIRS = ['pages/admin', 'src/components/admin'];
const KA_DIR = path.join(root, 'src/i18n/admin/ka');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function collectUsedKeys() {
  const used = new Map();
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(root, dir))) {
      const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === 'at' || node.expression.text === 'atf')) {
          const arg = node.arguments[0];
          if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
            if (!used.has(arg.text)) used.set(arg.text, path.relative(root, file));
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  return used;
}

function collectKaKeys() {
  const keys = new Set();
  for (const file of walk(KA_DIR)) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.name) || ts.isIdentifier(node.name))) keys.add(node.name.text);
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return keys;
}

const used = collectUsedKeys();
const ka = collectKaKeys();
const missing = [...used.entries()].filter(([k]) => !ka.has(k));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(missing.map(([k]) => k), null, 1));
  process.exit(0);
}
if (missing.length) {
  console.error(`Admin i18n: ${missing.length} of ${used.size} strings have no Georgian translation:`);
  for (const [k, file] of missing) console.error(`  ${file}: ${JSON.stringify(k)}`);
  process.exit(1);
}
console.log(`Admin i18n: all ${used.size} strings have Georgian translations.`);
