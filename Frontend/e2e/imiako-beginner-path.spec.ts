import { test, expect, Page } from '@playwright/test';

// IMIAKO Beginner Learning Path — a true zero-beginner/A1-start learner
// must see a deterministic greetings-first onboarding (Hello -> word cards
// -> "What is your name?" -> personalized sentences), never the free-form
// AI-generated READING passage the product previously defaulted to. See
// Backend's beginnerCurriculumService.ts/routes/englishTutor.ts for the
// server side of everything asserted here.
//
// Deliberately registers its OWN brand-new account per test rather than
// reusing the suite's shared seeded QA user (see global-setup.ts) — the
// whole point of this feature is "what a NEVER-SEEN-BEFORE account
// experiences," and the shared fixture user already has tutorNativeLang
// set from other English Tutor specs, which would make it ineligible for
// the Beginner Path by design (see loadOrLazilyCreateBeginnerProgress's
// own comment in routes/englishTutor.ts).
async function registerFreshStudent(page: Page, namePrefix: string): Promise<string> {
  const email = `${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@cdc.test`;
  await page.goto('/auth/register');
  await page.locator('#name').fill('QA Beginner');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('BeginnerTest123!');
  await page.locator('#phone').fill('+995555000222');
  await page.locator('form input[type="checkbox"]').check();
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/courses/, { timeout: 15000 });
  return email;
}

async function dismissCookieBanner(page: Page) {
  const accept = page.getByRole('button', { name: /დადასტურება|Accept/i }).first();
  if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) await accept.click();
}

// Drives TutorOnboardingFlow to completion: language -> goal -> A1 level ->
// "Start Learning". Mirrors the real click path a brand-new student takes;
// no shortcuts through the API.
async function completeOnboardingAsA1(page: Page) {
  await page.goto('/dashboard/english-tutor');
  await dismissCookieBanner(page);

  await page.getByRole('button', { name: /^ქართული/ }).click();
  await page.getByRole('button', { name: /^შემდეგი$/ }).click();

  await page.getByRole('button', { name: /მოგზაურობა/ }).click();
  await page.getByRole('button', { name: /^შემდეგი$/ }).click();

  await page.getByRole('button', { name: /^A1/ }).click();
  await page.getByRole('button', { name: /სწავლის დაწყება/ }).click();
  await page.waitForTimeout(500);
}

test.describe('IMIAKO Beginner Path — true zero-beginner onboarding', () => {
  test('the onboarding native-language step does not offer Russian', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-norussian');
    await page.goto('/dashboard/english-tutor');
    await dismissCookieBanner(page);

    await expect(page.getByRole('button', { name: /Русский/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Azərbaycan/ })).toBeVisible(); // a real, still-offered option
  });

  test('a brand-new A1 learner sees a greeting, never a long reading passage', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-greet');
    await completeOnboardingAsA1(page);

    // The exact regression this whole feature exists to prevent.
    await expect(page.getByText(/^passage$/i)).toHaveCount(0);
    await expect(page.getByText('Hello!')).toBeVisible();
    await expect(page.getByRole('button', { name: /შემდეგი →|Continue →/ })).toBeVisible();
  });

  test('a WORD block shows audio, IPA, and a localized gloss', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-word');
    await completeOnboardingAsA1(page);

    await page.getByRole('button', { name: /შემდეგი →/ }).click(); // past GREETING -> WORD "hello"
    await expect(page.getByText('Hello', { exact: true })).toBeVisible();
    await expect(page.getByText('/həˈloʊ/')).toBeVisible();
    await expect(page.getByText('გამარჯობა')).toBeVisible(); // Georgian gloss, per onboarding's chosen language
    await expect(page.getByRole('button', { name: 'მოსმენა: Hello', exact: true })).toBeVisible(); // the WORD card's own audio control
  });

  test('a WRITE block rejects a wrong answer and accepts the right one', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-write');
    await completeOnboardingAsA1(page);

    // Walk forward to the WRITE block (greeting -> 4 word cards -> write:hello).
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /შემდეგი →/ }).click();
      await page.waitForTimeout(150);
    }
    const input = page.locator('input[placeholder]').last();
    await input.fill('Nonsense');
    await page.getByRole('button', { name: /^შემოწმება$/ }).click();
    await expect(page.getByText('სცადეთ თავიდან')).toBeVisible();

    await input.fill('');
    await input.fill('hello'); // lowercase — must still be accepted
    await page.getByRole('button', { name: /^შემოწმება$/ }).click();
    await expect(page.getByText(/Great job|მშვენიერია/i).or(page.getByText(/greet someone/i))).toBeVisible({ timeout: 5000 });
  });

  test('name personalization: the learner is asked their name and later sees "I am <name>."', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-name');
    await completeOnboardingAsA1(page);

    // Fast-forward through Stage 1 and into Stage 2 up to the name question.
    for (let i = 0; i < 20; i++) {
      const writeInput = page.locator('input[placeholder]').last();
      const checkBtn = page.getByRole('button', { name: /^შემოწმება$/ });
      if (await checkBtn.isVisible().catch(() => false)) {
        await writeInput.fill('Hello');
        await checkBtn.click();
        await page.waitForTimeout(200);
        continue;
      }
      const nextStageBtn = page.getByRole('button', { name: /შემდეგ ეტაპზე/ });
      if (await nextStageBtn.isVisible().catch(() => false)) {
        await nextStageBtn.click();
        await page.waitForTimeout(200);
        continue;
      }
      const whatIsYourName = page.getByText('What is your name?');
      if (await whatIsYourName.isVisible().catch(() => false)) break;
      const continueBtn = page.getByRole('button', { name: /შემდეგი →/ });
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
        await page.waitForTimeout(200);
      }
    }

    await expect(page.getByText('What is your name?')).toBeVisible();
    const nameField = page.locator('input[placeholder="Nino"]');
    await nameField.fill('Mariam');
    // .first() disambiguates from the site-wide cookie-consent banner's own
    // "დადასტურება" (Confirm/Accept) button, which can share this exact
    // label and still be present in the DOM at this point.
    await page.getByRole('button', { name: /დადასტურება/ }).first().click();

    await expect(page.getByText('I am Mariam.')).toBeVisible({ timeout: 5000 });
  });

  test('the support-language selector switches the gloss without resetting the current block', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-lang');
    await completeOnboardingAsA1(page);
    await page.getByRole('button', { name: /შემდეგი →/ }).click(); // reach the "hello" WORD block

    await expect(page.getByText('გამარჯობა')).toBeVisible(); // Georgian gloss from onboarding

    await page.getByRole('button', { name: /სწავლის პარამეტრები/ }).click();
    const select = page.locator('#beginner-support-lang');
    await expect(select).toHaveValue('ka');

    // Platform-wide policy (2026-10): Russian must not be offered here.
    const optionValues = await select.locator('option').evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    expect(optionValues).not.toContain('ru');
    const optionLabels = await select.locator('option').allTextContents();
    expect(optionLabels.join(' ')).not.toMatch(/Русский|Russian/i);

    await select.selectOption('de');

    // Still the SAME block (English word unchanged, Continue button intact)
    // — only the gloss changed, proving the switch never resets progress.
    await expect(page.getByText('Hello', { exact: true })).toBeVisible();
    await expect(page.getByText('Hallo')).toBeVisible();
    await expect(page.getByText('გამარჯობა')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /შემდეგი →/ })).toBeVisible();
  });

  test('skipping the Beginner Path exits to the normal lesson-generation form', async ({ page }) => {
    await registerFreshStudent(page, 'qa-imiako-skip');
    await completeOnboardingAsA1(page);

    await page.getByRole('button', { name: /გამოტოვება/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('თქვენი მშობლიური/დამხმარე ენა')).toBeVisible({ timeout: 5000 });
  });

  test.describe('mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the Beginner Path renders without horizontal overflow on a phone-sized screen', async ({ page }) => {
      await registerFreshStudent(page, 'qa-imiako-mobile');
      await completeOnboardingAsA1(page);

      await expect(page.getByText('Hello!')).toBeVisible();
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(hasOverflow).toBe(false);

      const continueBtn = page.getByRole('button', { name: /შემდეგი →/ });
      const box = await continueBtn.boundingBox();
      expect(box).not.toBeNull();
      // A tappable primary action should be comfortably touch-sized, not a
      // tiny desktop-only hit target (section 21's "large audio buttons,
      // easy tap targets" requirement).
      expect(box!.height).toBeGreaterThanOrEqual(36);
    });
  });
});
