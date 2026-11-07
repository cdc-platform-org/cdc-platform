import { expect, test } from '@playwright/test';

const QUIZ_A = {
  title: 'Quiz A',
  language: 'en',
  questions: [
    {
      id: 'question-1',
      type: 'MULTIPLE_CHOICE',
      question: 'What is 2 + 2?',
      options: { A: '3', B: '4', C: '5' },
    },
    {
      id: 'question-2',
      type: 'FREE_TEXT',
      question: 'Explain your answer.',
      options: null,
    },
  ],
};

const QUIZ_B = {
  title: 'Quiz B',
  language: 'en',
  questions: [
    {
      id: 'q-b-1',
      type: 'FREE_TEXT',
      question: 'Name a planet.',
      options: null,
    },
  ],
};

function mockQuiz(page: import('@playwright/test').Page, id: string, quiz: unknown) {
  return page.route(`**/api/quiz/${id}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: quiz }) });
  });
}

// Fix D6: draft storage is now keyed by quizId + normalized student name
// (see getQuizStorageKeys/normalizeStudentKey in pages/quiz/[quizId].tsx),
// not quizId alone — these tests seed/assert against that new key shape.
const answersKey = (quizId: string, name: string) => `quiz-${quizId}-${name.trim().toLowerCase().replace(/\s+/g, ' ')}-answers`;
const startTimeKey = (quizId: string, name: string) => `quiz-${quizId}-${name.trim().toLowerCase().replace(/\s+/g, ' ')}-start-time`;
const elapsedKey = (quizId: string, name: string) => `quiz-${quizId}-${name.trim().toLowerCase().replace(/\s+/g, ' ')}-elapsed-seconds`;

test('refresh restores only valid IDs for the current quiz and drops stale keys', async ({ page }) => {
  await mockQuiz(page, 'quiz-a', QUIZ_A);

  await page.addInitScript(
    ({ key, startKey, elapsedSecondsKey }) => {
      localStorage.setItem(key, JSON.stringify({ 'question-1': 'B', 'question-2': 'Current answer', 'stale-id': 'junk' }));
      localStorage.setItem(startKey, String(Date.now()));
      localStorage.setItem(elapsedSecondsKey, '15');
    },
    { key: answersKey('quiz-a', 'Test Student'), startKey: startTimeKey('quiz-a', 'Test Student'), elapsedSecondsKey: elapsedKey('quiz-a', 'Test Student') }
  );

  await page.goto('/quiz/quiz-a');

  await page.locator('input[placeholder]').first().fill('Test Student');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();

  await expect(page.getByText('What is 2 + 2?')).toBeVisible();
  await expect(page.locator('input[name="question-1"]')).toHaveCount(3);

  const storageValue = await page.evaluate((key) => localStorage.getItem(key), answersKey('quiz-a', 'Test Student'));
  expect(storageValue).toBe(JSON.stringify({ 'question-1': 'B', 'question-2': 'Current answer' }));

  await expect(page.getByRole('textbox')).toHaveValue('Current answer');
});

test('D6: same student (same typed name) recovers their own draft after a hard refresh', async ({ page }) => {
  await mockQuiz(page, 'quiz-a', QUIZ_A);
  await page.goto('/quiz/quiz-a');

  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();
  await expect(page.getByText('What is 2 + 2?')).toBeVisible();

  await page.locator('input[name="question-1"][value="B"]').check();
  await page.getByRole('textbox').fill('My free-text answer');

  await page.reload();
  // Hard refresh drops back to the name-entry screen (phase/name are not
  // persisted, by design — see the report's D6 Refresh Recovery section for
  // why auto-skipping this was rejected as unsafe) — re-entering the SAME
  // name must recover the SAME draft.
  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();

  await expect(page.locator('input[name="question-1"][value="B"]')).toBeChecked();
  await expect(page.getByRole('textbox')).toHaveValue('My free-text answer');
});

test('D6: a second student (different typed name) on the same quiz/browser does NOT see the first student\'s draft', async ({ page }) => {
  await mockQuiz(page, 'quiz-a', QUIZ_A);
  await page.goto('/quiz/quiz-a');

  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();
  await page.locator('input[name="question-1"][value="B"]').check();
  await page.getByRole('textbox').fill('Student A private answer');

  // Same browser/tab, same quiz link — Student B's turn, without closing
  // anything, exactly the confirmed-defect scenario.
  await page.goto('/quiz/quiz-a');
  await page.locator('input[placeholder]').first().fill('Student B');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();

  await expect(page.locator('input[name="question-1"][value="B"]')).not.toBeChecked();
  await expect(page.getByRole('textbox')).toHaveValue('');

  // Student A's draft is untouched, not merged/overwritten — still
  // recoverable if Student A ever comes back and re-types their own name.
  const studentAAnswers = await page.evaluate((key) => localStorage.getItem(key), answersKey('quiz-a', 'Student A'));
  expect(studentAAnswers).toBe(JSON.stringify({ 'question-1': 'B', 'question-2': 'Student A private answer' }));
});

test('D6: a second quiz on the same browser does not see the first quiz\'s draft', async ({ page }) => {
  await mockQuiz(page, 'quiz-a', QUIZ_A);
  await mockQuiz(page, 'quiz-b', QUIZ_B);

  await page.goto('/quiz/quiz-a');
  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();
  await page.getByRole('textbox').fill('Quiz A answer');

  await page.goto('/quiz/quiz-b');
  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();

  await expect(page.getByText('Name a planet.')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('D6: successful submission removes the draft storage for that student/quiz', async ({ page }) => {
  await mockQuiz(page, 'quiz-a', QUIZ_A);
  await page.route('**/api/quiz/quiz-a/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { submissionId: 'sub-1', score: 100, correctCount: 2, total: 2, results: [{ questionId: 'question-1', correct: true }, { questionId: 'question-2', correct: true }] } }),
    });
  });

  await page.goto('/quiz/quiz-a');
  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();
  await page.locator('input[name="question-1"][value="B"]').check();
  await page.getByRole('textbox').fill('Final answer');
  await page.getByRole('button', { name: /Submit Answers|პასუხების გაგზავნა/i }).click();

  await expect(page.getByText(/Your Result|თქვენი შედეგი/i)).toBeVisible();

  const remaining = await page.evaluate((key) => localStorage.getItem(key), answersKey('quiz-a', 'Student A'));
  expect(remaining).toBeNull();
});

test('D6: a legacy (pre-fix, unscoped) draft key is never read into a new attempt', async ({ page }) => {
  await mockQuiz(page, 'quiz-a', QUIZ_A);
  await page.addInitScript(() => {
    // The old, pre-fix key shape — quizId only, no student component.
    localStorage.setItem('quiz-quiz-a-answers', JSON.stringify({ 'question-1': 'B', 'question-2': 'Old unscoped answer' }));
  });

  await page.goto('/quiz/quiz-a');
  await page.locator('input[placeholder]').first().fill('Student A');
  await page.getByRole('button', { name: /Start Quiz|ტესტის დაწყება/i }).click();

  await expect(page.locator('input[name="question-1"][value="B"]')).not.toBeChecked();
  await expect(page.getByRole('textbox')).toHaveValue('');

  // Best-effort cleanup: the legacy key should also be gone afterward.
  const legacyValue = await page.evaluate(() => localStorage.getItem('quiz-quiz-a-answers'));
  expect(legacyValue).toBeNull();
});
