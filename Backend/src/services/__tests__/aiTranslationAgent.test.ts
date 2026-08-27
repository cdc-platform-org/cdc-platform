// Mocked at the callTextModel boundary (aiAgentService.ts) — same convention
// as aiExamService.test.ts. No real Gemini call happens in this suite; it's
// about the agent's own scan/merge/patch/branch logic, not the model
// integration underneath (that's aiAgentService's own concern).
jest.mock('../aiAgentService', () => ({
  ...jest.requireActual('../aiAgentService'),
  callTextModel: jest.fn(),
}));

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { scanMissingTranslations, patchLocaleFile, runI18nAutoTranslateAgent } from '../aiTranslationAgent';
import { callTextModel } from '../aiAgentService';

const mockedCallTextModel = callTextModel as jest.MockedFunction<typeof callTextModel>;

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// Builds a disposable locales/ tree with a real, missing/empty key spread
// across a nested namespace — mirrors this repo's real public/locales shape
// (en.json is the source of truth; auth.json-style nesting is real, see
// scripts/check-locale-parity.js's own comment) without touching the actual
// Frontend/public/locales files at all.
async function makeFixtureLocalesDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'i18n-agent-test-'));
  await writeJson(path.join(dir, 'en', 'common.json'), {
    greeting: 'Hello',
    nested: { farewell: 'Goodbye', scopeItems: ['one', 'two'] },
  });
  // ka: fully translated already — should never be touched.
  await writeJson(path.join(dir, 'ka', 'common.json'), {
    greeting: 'გამარჯობა',
    nested: { farewell: 'ნახვამდის', scopeItems: ['one', 'two'] },
  });
  // fr: missing `greeting`, empty `nested.farewell`, already has the array
  // (so the array itself isn't "missing" here — a separate case below covers
  // a genuinely absent array key).
  await writeJson(path.join(dir, 'fr', 'common.json'), {
    nested: { farewell: '', scopeItems: ['one', 'two'] },
  });
  // de: has everything except the array key entirely — must be flagged as
  // skipped (non-string), never guessed at by the translator.
  await writeJson(path.join(dir, 'de', 'common.json'), {
    greeting: 'Hallo',
    nested: { farewell: 'Auf Wiedersehen' },
  });
  return dir;
}

describe('aiTranslationAgent', () => {
  beforeEach(() => {
    mockedCallTextModel.mockReset();
  });

  describe('scanMissingTranslations', () => {
    it('finds missing and empty string keys, skips non-string keys, and leaves a fully-translated locale untouched', async () => {
      const dir = await makeFixtureLocalesDir();
      try {
        const groups = await scanMissingTranslations(dir);

        const frGroup = groups.find((g) => g.locale === 'fr' && g.namespace === 'common.json');
        expect(frGroup).toBeDefined();
        expect(frGroup!.missingStringKeys).toEqual({ greeting: 'Hello', 'nested.farewell': 'Goodbye' });
        expect(frGroup!.skippedNonStringKeys).toEqual([]);

        const deGroup = groups.find((g) => g.locale === 'de' && g.namespace === 'common.json');
        expect(deGroup).toBeDefined();
        expect(deGroup!.missingStringKeys).toEqual({});
        expect(deGroup!.skippedNonStringKeys).toEqual(['nested.scopeItems']);

        const kaGroup = groups.find((g) => g.locale === 'ka');
        expect(kaGroup).toBeUndefined();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe('patchLocaleFile', () => {
    it('merges translated keys into the existing file without touching untouched keys', async () => {
      const dir = await makeFixtureLocalesDir();
      try {
        const before = JSON.parse(await fs.readFile(path.join(dir, 'fr', 'common.json'), 'utf-8'));
        expect(before.nested.scopeItems).toEqual(['one', 'two']);

        await patchLocaleFile(dir, 'fr', 'common.json', { greeting: 'Bonjour', 'nested.farewell': 'Au revoir' });

        const after = JSON.parse(await fs.readFile(path.join(dir, 'fr', 'common.json'), 'utf-8'));
        expect(after.greeting).toBe('Bonjour');
        expect(after.nested.farewell).toBe('Au revoir');
        // The array that was already there survives the patch untouched —
        // this is the "without corrupting existing translation keys"
        // guarantee the patch step exists to provide.
        expect(after.nested.scopeItems).toEqual(['one', 'two']);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe('runI18nAutoTranslateAgent', () => {
    it('dry run computes what it would patch without writing files or touching git', async () => {
      const dir = await makeFixtureLocalesDir();
      try {
        mockedCallTextModel.mockResolvedValue(JSON.stringify({ greeting: 'Bonjour', 'nested.farewell': 'Au revoir' }));

        const result = await runI18nAutoTranslateAgent({ localesDir: dir, dryRun: true });

        expect(result.totalKeysPatched).toBe(2);
        expect(result.gitBranch).toBeNull();
        const stillOriginal = JSON.parse(await fs.readFile(path.join(dir, 'fr', 'common.json'), 'utf-8'));
        expect(stillOriginal.greeting).toBeUndefined();
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });

    it('a real run patches files, commits to a new local branch, and never touches the original branch or pushes anywhere', async () => {
      const dir = await makeFixtureLocalesDir();
      try {
        // The git-commit step needs `dir` to actually be a git repo — set
        // up a disposable one so the branch/commit logic runs for real
        // (not mocked), the same "mock only the external boundary" posture
        // this repo's other integration tests already use for Prisma/DB.
        execFileSync('git', ['init', '-q'], { cwd: dir });
        execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
        execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
        execFileSync('git', ['add', '.'], { cwd: dir });
        execFileSync('git', ['commit', '-q', '-m', 'initial fixture'], { cwd: dir });
        const originalBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir }).toString().trim();

        mockedCallTextModel.mockResolvedValue(JSON.stringify({ greeting: 'Bonjour', 'nested.farewell': 'Au revoir' }));

        const result = await runI18nAutoTranslateAgent({ localesDir: dir });

        expect(result.totalKeysPatched).toBe(2);
        expect(result.validationPassed).toBe(true);
        expect(result.gitBranch).not.toBeNull();

        // The function leaves the working tree back on `originalBranch`
        // once it returns (by design — the patch is isolated to the new
        // branch, current work is never touched), so the live file on disk
        // at this point correctly still shows the ORIGINAL content. Assert
        // the current branch really is unchanged, then read the patch back
        // out of the new branch's own commit via `git show`.
        const branchAfterReturn = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir }).toString().trim();
        expect(branchAfterReturn).toBe(originalBranch);
        const stillOriginalOnDisk = JSON.parse(await fs.readFile(path.join(dir, 'fr', 'common.json'), 'utf-8'));
        expect(stillOriginalOnDisk.greeting).toBeUndefined();

        const patchedOnBranch = JSON.parse(
          execFileSync('git', ['show', `${result.gitBranch}:fr/common.json`], { cwd: dir }).toString()
        );
        expect(patchedOnBranch.greeting).toBe('Bonjour');
        expect(patchedOnBranch.nested.farewell).toBe('Au revoir');
        // The array already on that key survives the patch untouched.
        expect(patchedOnBranch.nested.scopeItems).toEqual(['one', 'two']);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });
});
