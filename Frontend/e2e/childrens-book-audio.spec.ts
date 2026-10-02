import { createRequire } from 'node:module';
import path from 'node:path';
import { expect, request as playwrightRequest, test, APIRequestContext, Page } from '@playwright/test';
import { AUTH_STATE_PATH } from './global-setup';

const apiBaseUrl = process.env.BOOK_API_URL || 'http://localhost:4001/api/';
const backendRequire = createRequire(path.resolve(process.cwd(), '../Backend/package.json'));
const { PDFDocument } = backendRequire('pdf-lib');

test.use({ storageState: AUTH_STATE_PATH });

async function apiJson(api: APIRequestContext, method: 'get' | 'post' | 'patch', route: string, data?: unknown) {
  const response = await api[method](route.replace(/^\//, ''), data === undefined ? undefined : { data });
  expect(response.ok(), `${method.toUpperCase()} ${route} returned ${response.status()}`).toBeTruthy();
  return response.json();
}

async function createBookPath(api: APIRequestContext, pageCount: number, withAudio: boolean, title: string) {
  const created = await apiJson(api, 'post', '/childrens-books', {
    language: 'EN',
    title,
    pageCount,
    character: { name: 'Milo', age: 7, traits: ['curious', 'kind'] },
  });
  const id = created.data.id as string;
  await apiJson(api, 'post', `/childrens-books/${id}/story-plan`);
  await apiJson(api, 'post', `/childrens-books/${id}/character-preview`);
  await apiJson(api, 'post', `/childrens-books/${id}/character-approval`);
  if (withAudio) await apiJson(api, 'patch', `/childrens-books/${id}/audio-upgrade`, { audioAddOnPurchased: true });

  const beforePayment = (await apiJson(api, 'get', `/childrens-books/${id}`)).data;
  expect(beforePayment.priceGel).toBe(pageCount * 100);
  expect(beforePayment.totalPriceGel).toBe(pageCount * 100 + (withAudio ? 500 : 0));

  await apiJson(api, 'post', `/childrens-books/${id}/payment/dev-simulate`);
  const generation = await apiJson(api, 'post', `/childrens-books/${id}/final-generation/start`);
  expect(generation.acceptedCount).toBe(pageCount);
  expect(generation.mocked).toBe(true);

  let narrationCount = 0;
  if (withAudio) {
    const narration = await apiJson(api, 'post', `/childrens-books/${id}/audio/generate`);
    narrationCount = narration.data.artifacts.length;
    expect(narrationCount).toBe(pageCount);
  } else {
    const status = await apiJson(api, 'get', `/childrens-books/${id}/audio/status`);
    expect(status.data.artifacts).toHaveLength(0);
  }

  await apiJson(api, 'post', `/childrens-books/${id}/pdf`);
  const pdfResponse = await api.get(`childrens-books/${id}/pdf/download`);
  expect(pdfResponse.ok()).toBeTruthy();
  const pdf = await PDFDocument.load(await pdfResponse.body());
  expect(pdf.getPageCount()).toBe(pageCount);

  const book = (await apiJson(api, 'get', `/childrens-books/${id}`)).data;
  expect(['FINAL_READY', 'COMPLETED']).toContain(book.status);
  expect(book.pages).toHaveLength(pageCount);
  expect(book.pdfStatus).toBe('CURRENT');
  return { id, book, narrationCount };
}

async function createApprovedAudioUpsellBook(api: APIRequestContext, title: string) {
  const created = await apiJson(api, 'post', '/childrens-books', {
    language: 'EN',
    title,
    pageCount: 5,
    character: { name: 'Milo', age: 7 },
  });
  const id = created.data.id as string;
  await apiJson(api, 'post', `/childrens-books/${id}/story-plan`);
  await apiJson(api, 'post', `/childrens-books/${id}/character-preview`);
  await apiJson(api, 'post', `/childrens-books/${id}/character-approval`);
  return id;
}

async function openAuthenticatedBook(page: Page, bookId: string) {
  await page.goto(`/en/dashboard/tools/childrens-book/reader/${bookId}`);
  await expect(page.getByText(/^Page 1 \/ \d+$/).first()).toBeVisible({ timeout: 15000 });
}

test('children book 5/10/20-page mock golden paths, audio revision, and reader UI', async ({ page }) => {
  test.setTimeout(90000);
  const books: Array<{ id: string; book: any; narrationCount: number }> = [];
  const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto('/en/dashboard/tools/childrens-book');
    await expect(page.getByRole('heading', { name: /Children|Book/i }).first()).toBeVisible({ timeout: 15000 });
    const acceptCookies = page.getByRole('button', { name: 'Accept All' });
    if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click();
    const token = await page.evaluate(() => localStorage.getItem('cdc_access_token'));
    expect(token).toBeTruthy();
    await api.dispose();
    const authenticatedApi = await playwrightRequest.newContext({
      baseURL: apiBaseUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const runId = Date.now().toString();
    const wizardTitle = `QA ${runId} UI Wizard Book`;
    const quietTitle = `QA ${runId} 5 Page Quiet Story`;
    const audioTitle = `QA ${runId} 10 Page Audio Story`;
    const longAudioTitle = `QA ${runId} 20 Page Audio Story`;
    const upsellTitle = `QA ${runId} Audio Upsell Story`;

    await page.getByText('5 pages', { exact: true }).click();
    await page.getByPlaceholder("e.g. Mimi's Great Adventure").fill(wizardTitle);
    await page.getByPlaceholder('e.g. Mimi', { exact: true }).fill('Milo');
    await page.getByRole('button', { name: 'Create Book' }).click();
    await expect(page.getByRole('heading', { name: wizardTitle })).toBeVisible();
    const wizardBookId = new URL(page.url()).searchParams.get('bookId');
    expect(wizardBookId).toBeTruthy();
    const wizardBook = (await apiJson(authenticatedApi, 'get', `/childrens-books/${wizardBookId}`)).data;
    expect(wizardBook.pageCount).toBe(5);
    expect(wizardBook.priceGel).toBe(500);
    expect(wizardBook.audioAddOnPurchased).toBe(false);
    await page.goto('/en/dashboard/tools/childrens-book');

    books.push(await createBookPath(authenticatedApi, 5, false, quietTitle));
    books.push(await createBookPath(authenticatedApi, 10, true, audioTitle));
    books.push(await createBookPath(authenticatedApi, 20, true, longAudioTitle));
    const upsellBookId = await createApprovedAudioUpsellBook(authenticatedApi, upsellTitle);
    expect(books.map(({ narrationCount }) => narrationCount)).toEqual([0, 10, 20]);

    const audioBook = books[1];
    const image = await authenticatedApi.get(`childrens-books/${audioBook.id}/page/1/image`);
    expect(image.ok()).toBeTruthy();
    expect(image.headers()['content-type']).toContain('image/png');
    const audio = await authenticatedApi.get(`childrens-books/${audioBook.id}/audio/page/1`);
    expect(audio.ok()).toBeTruthy();
    expect(audio.headers()['content-type']).toContain('audio/wav');
    const firstPageAudio = await audio.body();
    expect(firstPageAudio.subarray(0, 4).toString('ascii')).toBe('RIFF');
    const secondPageAudio = await authenticatedApi.get(`childrens-books/${audioBook.id}/audio/page/2`);
    expect((await secondPageAudio.body()).equals(firstPageAudio)).toBe(false);

    const before = (await apiJson(authenticatedApi, 'get', `/childrens-books/${audioBook.id}/audio/status`)).data.artifacts;
    const originalRefs = new Map(before.filter((artifact: any) => artifact.revisionVersion === 0).map((artifact: any) => [artifact.pageNumber, artifact.id]));
    const revisionResponse = await authenticatedApi.post(`childrens-books/${audioBook.id}/revision`, {
      data: { pageNumber: 5, note: 'Make the lantern brighter' },
    });
    const revisionBody = await revisionResponse.json();
    expect(revisionResponse.ok(), JSON.stringify(revisionBody)).toBeTruthy();
    expect(revisionBody.data.revisionUsed).toBe(true);
    const after = (await apiJson(authenticatedApi, 'get', `/childrens-books/${audioBook.id}/audio/status`)).data.artifacts;
    const revisedArtifacts = after.filter((artifact: any) => artifact.revisionVersion === 1);
    expect(revisedArtifacts.map((artifact: any) => artifact.pageNumber)).toEqual([5]);
    for (const artifact of after.filter((entry: any) => entry.revisionVersion === 0)) {
      expect(artifact.id).toBe(originalRefs.get(artifact.pageNumber));
    }
    const secondRevision = await authenticatedApi.post(`childrens-books/${audioBook.id}/revision`, { data: { pageNumber: 6 } });
    expect(secondRevision.status()).toBe(400);
    await apiJson(authenticatedApi, 'post', `/childrens-books/${audioBook.id}/pdf`);
    const revisedPdfResponse = await authenticatedApi.get(`childrens-books/${audioBook.id}/pdf/download`);
    const revisedPdf = await PDFDocument.load(await revisedPdfResponse.body());
    expect(revisedPdf.getPageCount()).toBe(10);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/dashboard/tools/childrens-book?bookId=${upsellBookId}`);
    await expect(page.getByText('Book: 5 GEL · Audio: 0 GEL · Total: 5 GEL', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/book-audio-upsell-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Add for 10 GEL' }).click();
    await expect(page.getByText('Book: 5 GEL · Audio: 5 GEL · Total: 10 GEL', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'devSimulateButton' })).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 812 });
    const wizardMobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(wizardMobileWidth).toBeLessThanOrEqual(375);
    await page.screenshot({ path: 'test-results/book-audio-upsell-mobile.png', fullPage: true });
    await page.goto('/en/dashboard/tools/childrens-book');
    const mobileAudioCard = page.locator('article').filter({ hasText: audioTitle });
    await expect(mobileAudioCard.getByRole('button', { name: 'Listen' })).toBeVisible();
    const myBooksMobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(myBooksMobileWidth).toBeLessThanOrEqual(375);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/dashboard/tools/childrens-book');
    const quietCard = page.locator('article').filter({ hasText: quietTitle });
    const audioCard = page.locator('article').filter({ hasText: audioTitle });
    await expect(quietCard.getByRole('button', { name: 'Read' })).toBeVisible();
    await expect(quietCard.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
    await expect(quietCard.getByRole('button', { name: 'Listen' })).toHaveCount(0);
    await expect(audioCard.getByText('Audio Story', { exact: true })).toBeVisible();
    await expect(audioCard.getByRole('button', { name: 'Listen' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await audioCard.getByRole('button', { name: 'Download PDF' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(audioTitle);

    await openAuthenticatedBook(page, audioBook.id);
    await expect(page.getByText('Page 1 / 10', { exact: true }).first()).toBeVisible();
    const readerImage = page.locator('img[alt*="page 1"]');
    await expect(readerImage).toBeVisible();
    await expect.poll(() => readerImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1024);
    await page.screenshot({ path: 'test-results/book-reader-desktop.png', fullPage: true });
    const readerAudio = page.locator('audio');
    expect(await readerAudio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
    await expect(page.getByRole('button', { name: 'Play Full Story' })).toBeEnabled();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 / 10', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.getByText('Page 1 / 10', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect.poll(async () => Number(await page.getByRole('progressbar', { name: 'Audio progress' }).getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Play Full Story' }).click();
    await expect(page.getByText('Page 10 / 10', { exact: true }).first()).toBeVisible({ timeout: 15000 });

    await openAuthenticatedBook(page, books[0].id);
    await expect(page.getByRole('region', { name: 'Audio controls' })).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 812 });
    await openAuthenticatedBook(page, audioBook.id);
    const mobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(mobileWidth).toBeLessThanOrEqual(375);
    await page.screenshot({ path: 'test-results/book-reader-mobile.png', fullPage: true });
    await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/dashboard/tools/childrens-book?bookId=${audioBook.id}`);
    await expect(page.getByText('Generate audio story')).toHaveCount(0);
    const desktopWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(desktopWidth).toBeLessThanOrEqual(1440);
    await expect(page.getByText(/statusValue\./)).toHaveCount(0);
    expect(pageErrors).toEqual([]);

    await authenticatedApi.dispose();
  } finally {
    await api.dispose();
  }
});