import { test, expect } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

// Fixed fixtures from Backend/prisma/seedE2E.ts — a Vibe Coding IAKO
// profile assigned to the free training the QA learner is already
// enrolled in, small usage limits, vision enabled.
const FREE_LIVE_TRAINING_ID = '00000000-0000-4000-8000-000000007a11';

test.use({ storageState: AUTH_STATE_PATH });
// This exercises the real, unmocked AI provider (2-3 live calls: scope
// classification + the main answer, per message) — matches product-
// direction section 22's "before PR, verify this realistic learner
// journey", not something a mocked unit test can substitute for. Slower
// and depends on the provider actually being configured and responsive.
test.setTimeout(240_000);

test('realistic learner journey: Digital Tools -> IAKO -> in-scope help, screenshot, refusal, Today\'s Guide', async ({ page }) => {
  await page.route(/https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());

  // 1. Digital Tools shows IAKO as its own entry, not buried under Daily Guides.
  await page.goto('/en/dashboard/tools');
  const iakoCard = page.locator('div.rounded-2xl', { has: page.getByText('Vibe Coding Full-Stack AI Mentor') });
  await expect(iakoCard).toBeVisible({ timeout: 15000 });
  await expect(iakoCard.getByText('Active', { exact: true })).toBeVisible();
  // The IAKO card's own action label is "Open IAKO" (mentor-first —
  // see dashboard/tools/index.tsx's actionLabel), not the generic
  // "Manage" every other tool card falls back to.
  await iakoCard.getByRole('link', { name: /open iako/i }).click();

  // 2. Lands on the dedicated, mentor-primary IAKO page.
  await expect(page).toHaveURL(new RegExp(`/dashboard/live-trainings/${FREE_LIVE_TRAINING_ID}/iako`));
  await expect(page.getByRole('heading', { name: 'IAKO', level: 1 })).toBeVisible();
  await expect(page.getByText('Vibe Coding Full-Stack AI Mentor')).toBeVisible();
  await expect(page.getByText(/IAKO/).first()).toBeVisible();
  // Quick actions are all present, and the page isn't guide-dominated.
  await expect(page.getByRole('button', { name: /I have an error/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send Screenshot/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Help me build a feature/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Explain a topic/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Today's Guide/i })).toBeVisible();

  const textarea = page.locator('textarea');
  const sendButton = page.getByRole('button', { name: /^Send$/i });
  const logEntries = page.locator('[role="log"] > div');
  // Idempotent across reruns against a non-reset local DB (same posture as
  // e2e/store-purchase.spec.ts's own comment) — this QA learner's IAKO
  // conversation on this training may already carry history from an
  // earlier run, so assertions below key off relative position/content,
  // never an absolute count from a captured "before" baseline.

  // 3. An in-scope technical question gets real help.
  await textarea.fill('What is Supabase, briefly?');
  await sendButton.click();
  // Some real assistant reply appeared (content is non-deterministic — only
  // structure is asserted). Not an absolute-count check: on a genuinely
  // fresh conversation (no prior history at all) the welcome banner is
  // itself one of these [role="log"] > div children and is REPLACED —
  // not added to — once real messages exist, so the log only grows by
  // +1 (not +2) the very first time. nth(-2)/nth(-1) are relative to
  // whatever's there now, so they're correct either way once this turn lands.
  await expect(logEntries.nth(-2)).toContainText('What is Supabase', { timeout: 60000 });
  await expect(page.getByText(/\d+ \/ \d+ requests used|\d+ requests used/)).toBeVisible();

  // 4. An unrelated question is refused with the canned message, not answered.
  const countBeforeRefusal = await logEntries.count();
  await textarea.fill('Which car should I buy?');
  await sendButton.click();
  await expect(logEntries).toHaveCount(countBeforeRefusal + 2, { timeout: 60000 });
  await expect(logEntries.last()).toContainText(/I can't help with that\. I'm IAKO/);

  // 5. Today's Guide is reachable but was never the primary surface.
  await page.getByRole('link', { name: /Today's Guide/i }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/live-trainings/${FREE_LIVE_TRAINING_ID}/guide`));
  await expect(page.getByRole('link', { name: /IAKO/i }).first()).toBeVisible();
});
