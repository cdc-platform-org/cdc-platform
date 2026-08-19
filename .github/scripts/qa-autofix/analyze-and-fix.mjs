// Runs only after a nightly QA run fails (see .github/workflows/qa-nightly.yml's
// `autofix` job) — reads the Playwright JSON report, asks Claude to draft a
// fix, and writes the proposed file(s) to disk. The workflow itself (not
// this script) then commits those changes to a new branch and opens a PR
// via peter-evans/create-pull-request — this script never touches git, and
// nothing here ever pushes to or opens a PR against `main` directly.
//
// Deliberately scoped to the FAILING SPEC FILE(S) themselves, not arbitrary
// application source: the overwhelming majority of E2E flakiness is a stale
// selector, a missing wait, or a test that assumed state the app doesn't
// actually guarantee — not a real product regression (see this suite's own
// build history: every failure hit while writing it was exactly this kind
// of test bug). Handing an LLM a single failing test file plus its error
// output is a scoped, reviewable diff; handing it the whole app with
// instructions to "fix the bug" on a single pass with no tool-use loop is
// far more likely to produce a plausible-looking but wrong change. If a
// failure is a genuine app regression, the proposed test-file fix simply
// won't make the suite pass — a human reviewing the PR (and the next
// nightly run) is the actual safety net, same as the existing CLAUDE.md
// review requirement for every PR in this codebase.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const REPORT_PATH = process.env.QA_REPORT_PATH || 'Frontend/playwright-report/results.json';
const FRONTEND_ROOT = 'Frontend';
const MAX_FAILURES = 5;

function loadFailures() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.log(`No report found at ${REPORT_PATH} — nothing to analyze.`);
    return [];
  }
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const failures = [];

  // Playwright's JSON reporter nests results as suites -> suites -> specs -> tests -> results.
  function walk(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const failedResult = test.results?.find((r) => r.status === 'failed' || r.status === 'timedOut');
        if (!failedResult) continue;
        failures.push({
          file: spec.file,
          title: spec.title,
          project: test.projectName,
          error: failedResult.error?.message || failedResult.errors?.[0]?.message || 'Unknown error',
          stack: failedResult.error?.stack || '',
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites ?? []) walk(suite);
  return failures;
}

// Groups per-test failures by spec file — one fix request per file, not per
// test, since multiple failing tests in the same file usually share one
// root cause (as happened repeatedly while building this suite: a shared
// `loginViaUI` helper issue showed up as failures in five different files).
function groupByFile(failures) {
  const byFile = new Map();
  for (const f of failures.slice(0, MAX_FAILURES)) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  return byFile;
}

function isSafePath(relPath) {
  const normalized = path.normalize(relPath);
  return normalized.startsWith('e2e' + path.sep) && !normalized.includes('..');
}

async function fixFile(client, relFile, fileFailures) {
  const absPath = path.join(FRONTEND_ROOT, relFile);
  if (!fs.existsSync(absPath)) {
    console.log(`Skipping ${relFile} — file not found on disk.`);
    return null;
  }
  const originalContent = fs.readFileSync(absPath, 'utf8');

  const failuresText = fileFailures
    .map((f, i) => `### Failure ${i + 1}: "${f.title}" [${f.project}]\n\nError:\n${f.error}\n\nStack:\n${f.stack}`)
    .join('\n\n');

  const message = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system:
      'You are fixing a failing Playwright E2E test in the CDC Platform repo. ' +
      'You will be given the full content of ONE failing spec file and the error output from a nightly CI run. ' +
      'Diagnose whether this is a test bug (bad selector, missing wait, wrong assumption about app state) and, if so, fix it. ' +
      "If the error suggests a real application regression rather than a test bug, do NOT invent a fix for application code you cannot see — instead return the file's content UNCHANGED and explain why in the summary. " +
      'Respond with ONLY a JSON object, no markdown fences, matching exactly: {"summary": string, "changed": boolean, "content": string} ' +
      'where "content" is the COMPLETE new file content (the whole file, not a diff or excerpt) — or the original content unchanged if "changed" is false.',
    messages: [
      {
        role: 'user',
        content:
          `Spec file: e2e/${relFile}\n\n\`\`\`typescript\n${originalContent}\n\`\`\`\n\n` +
          `Failures from last night's run:\n\n${failuresText}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) {
    console.log(`No text response for ${relFile}.`);
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    console.log(`Could not parse Claude's response for ${relFile} as JSON — skipping.`);
    return null;
  }

  if (!parsed.changed || typeof parsed.content !== 'string' || parsed.content === originalContent) {
    console.log(`No change proposed for ${relFile}: ${parsed.summary ?? '(no summary given)'}`);
    return null;
  }

  return { relFile, summary: parsed.summary, content: parsed.content };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set — skipping autofix.');
    process.exit(0); // not a hard failure of the workflow, just nothing to do
  }

  const failures = loadFailures();
  if (failures.length === 0) {
    console.log('No failures found in the report — nothing to fix.');
    process.exit(0);
  }

  const byFile = groupByFile(failures);
  const client = new Anthropic({ apiKey });
  const changes = [];
  const summaries = [];

  for (const [relFile, fileFailures] of byFile) {
    if (!isSafePath(relFile)) {
      console.log(`Refusing to touch ${relFile} — outside e2e/.`);
      continue;
    }
    const result = await fixFile(client, relFile, fileFailures);
    if (result) {
      fs.writeFileSync(path.join(FRONTEND_ROOT, result.relFile), result.content, 'utf8');
      changes.push(result.relFile);
      summaries.push(`- **${result.relFile}**: ${result.summary}`);
    } else {
      summaries.push(`- **${relFile}**: no automated fix applied (see logs)`);
    }
  }

  // Consumed by the workflow step that feeds create-pull-request's PR body.
  fs.writeFileSync(
    'qa-autofix-summary.md',
    `## Nightly QA auto-fix\n\n${summaries.join('\n')}\n\n` +
      (changes.length > 0
        ? `Changed files: ${changes.join(', ')}`
        : 'No files were changed — either every failure looked like a real app regression, or no fix could be confidently drafted.'),
    'utf8'
  );

  console.log(changes.length > 0 ? `Proposed fixes for: ${changes.join(', ')}` : 'No changes proposed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
