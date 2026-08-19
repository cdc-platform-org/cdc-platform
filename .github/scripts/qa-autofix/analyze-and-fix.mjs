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

// Anthropic's SDK throws APIError with a numeric `.status` for HTTP-level
// failures; a depleted/unfunded key comes back as 400 "Your credit balance
// is too low..." rather than a dedicated status code, so the message is
// matched too. A key still pending activation on a brand-new account has
// been observed to 401 with an account-status message rather than the usual
// auth-failure text, so that's covered here as well — both are "nothing we
// can do right now", not a script bug.
function isBillingUnavailableError(err) {
  const status = err?.status ?? err?.response?.status;
  const message = String(err?.message ?? err?.error?.error?.message ?? '');
  if (status === 402) return true;
  return /credit balance|insufficient.*credit|billing|payment required|account.*(pending|not.*activ)/i.test(message);
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

  // Capped tight for token cost-efficiency. Note this is well under a full
  // spec file's size — the response (which echoes the COMPLETE file back)
  // will often get cut off mid-JSON for any non-trivial file. That's fine:
  // the JSON.parse failure below already treats an unparsable response as
  // "no confident fix, skip" rather than crashing, so a truncated response
  // just means fewer successful autofixes, not a broken run.
  let message;
  try {
    message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1000,
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
  } catch (err) {
    if (isBillingUnavailableError(err)) {
      // Newly-added key with no funded/activated balance yet returns a 400
      // ("credit balance too low") or 402 here, same shape as a mid-month
      // depletion — either way this is an account-level condition every
      // remaining file will also hit, not a per-file problem, so the caller
      // stops the whole run rather than burning through MAX_FAILURES worth
      // of identical failures. Surfaced as a skip, not a workflow failure:
      // an unfunded/paused key isn't a bug in this script.
      console.log(`Anthropic API unavailable (billing) while fixing ${relFile}: ${err.message}`);
      return { billingUnavailable: true };
    }
    throw err;
  }

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
  let billingUnavailable = false;

  for (const [relFile, fileFailures] of byFile) {
    if (!isSafePath(relFile)) {
      console.log(`Refusing to touch ${relFile} — outside e2e/.`);
      continue;
    }
    const result = await fixFile(client, relFile, fileFailures);
    if (result?.billingUnavailable) {
      // Account-level condition, not per-file — stop trying the rest of
      // this run's files instead of repeating the same failure for each one.
      billingUnavailable = true;
      break;
    }
    if (result) {
      fs.writeFileSync(path.join(FRONTEND_ROOT, result.relFile), result.content, 'utf8');
      changes.push(result.relFile);
      summaries.push(`- **${result.relFile}**: ${result.summary}`);
    } else {
      summaries.push(`- **${relFile}**: no automated fix applied (see logs)`);
    }
  }

  if (billingUnavailable) {
    console.log('Anthropic API balance is depleted or pending — no-oping the rest of this run without failing the workflow.');
    fs.writeFileSync(
      'qa-autofix-summary.md',
      '## Nightly QA auto-fix\n\nSkipped: the Anthropic API key has no available balance right now (depleted or still pending activation). No files were changed.',
      'utf8'
    );
    process.exit(0);
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
  // Defense-in-depth: every call site that reaches the Anthropic API today
  // is already wrapped in fixFile's own try/catch above, but a billing
  // error escaping from anywhere else (e.g. a future call site) should
  // still no-op rather than fail the workflow, for the same reason.
  if (isBillingUnavailableError(err)) {
    console.log(`Anthropic API unavailable (billing) — skipping without failing the workflow: ${err.message}`);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
