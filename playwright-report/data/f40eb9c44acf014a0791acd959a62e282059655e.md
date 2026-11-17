# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: childrens-book-audio.spec.ts >> children book 5/10/20-page mock golden paths, audio revision, and reader UI
- Location: e2e/childrens-book-audio.spec.ts:101:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Book: 5 GEL · Audio: 0 GEL · Total: 5 GEL', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Book: 5 GEL · Audio: 0 GEL · Total: 5 GEL', { exact: true })

```

```yaml
- status:
  - paragraph:
    - text: "The platform is in beta. Support:"
    - link "contact@cdc.org.ge":
      - /url: mailto:contact@cdc.org.ge
  - button "Dismiss"
- navigation:
  - link "CDC":
    - /url: /en
    - img "CDC"
    - text: CDC
  - button "Digital College"
  - button "Digital Market"
  - button "Employment"
  - link "Forum":
    - /url: /en/forum
  - button "About"
  - searchbox "Search courses, articles, products..."
  - button "Change language": en
  - button "Toggle dark mode"
  - button "Notifications": "1"
  - button "Q"
- main:
  - button "Back to My Books"
  - heading "QA 1794933707206 Audio Upsell Story" [level=1]
  - paragraph: "Status: Character approved"
  - text: "Development mode: this is a placeholder image, not a real AI generation. Audio Story add-on"
  - button "Add for 10 GEL"
  - paragraph: Mock audio uses local, browser-playable WAV files; no voice service is contacted.
  - text: Animated video
  - paragraph: Your book comes to life with narration, music and moving scenes. It is made right after the book is finished.
  - button "Add +10 GEL"
  - paragraph: "Book: 0 GEL · Audio: 0 GEL · Total: 0 GEL"
  - region "Book preview":
    - heading "Book preview" [level=2]
    - button "Edit text"
    - paragraph: "Here is your book before you pay: the cover, your character and the full story, page by page. Check that everything looks right."
    - img "Milo"
    - text: Cover
    - heading "QA 1794933707206 Audio Upsell Story" [level=3]
    - paragraph: Starring Milo
    - list:
      - listitem:
        - text: after payment Page 1
        - paragraph: Milo discovers a mysterious glowing map in the attic — a new page in the adventure (page 1).
      - listitem:
        - text: after payment Page 2
        - paragraph: Milo sets off on a first step into the unknown forest — a new page in the adventure (page 2).
      - listitem:
        - text: after payment Page 3
        - paragraph: Milo follows a trail of glowing mushrooms deeper into the trees — a new page in the adventure (page 3).
      - listitem:
        - text: after payment Page 4
        - paragraph: Milo meets a small animal friend who needs help — a new page in the adventure (page 4).
      - listitem:
        - text: after payment Page 5
        - paragraph: Milo builds a clever plan together with the new friend — a new page in the adventure (page 5).
    - paragraph: What you get after payment
    - list:
      - listitem: 5 fully illustrated pages with the story above
      - listitem: A downloadable PDF of the book
      - listitem: One free revision of any page
    - paragraph: "Total: 5 GEL"
    - paragraph: Illustrations are painted after payment, using the character you approved.
    - button "Looks good, continue to payment"
  - text: Font
  - paragraph: Choose the lettering for the story in the book and the PDF. You can change it any time, free of charge.
  - radiogroup "Font":
    - radio "Simple Nino's Adventure One sunny morning Nino walked into the magic forest…" [checked]
    - radio "Round and friendly Nino's Adventure One sunny morning Nino walked into the magic forest…"
    - radio "Modern Nino's Adventure One sunny morning Nino walked into the magic forest…"
    - radio "Fairy tale (classic) Nino's Adventure One sunny morning Nino walked into the magic forest…"
    - radio "Playful (handwritten) Nino's Adventure One sunny morning Nino walked into the magic forest…"
    - radio "Easy to read Nino's Adventure One sunny morning Nino walked into the magic forest…"
- contentinfo:
  - link "CDC":
    - /url: /en
    - img "CDC"
    - text: CDC
  - paragraph: Teaching digital professions in Guria — supported by HEKS/EPER Georgia.
  - list:
    - listitem:
      - link "contact@cdc.org.ge":
        - /url: mailto:contact@cdc.org.ge
    - listitem:
      - link "+995 551 14 14 11":
        - /url: tel:+995551141411
  - heading "Digital College" [level=3]
  - list:
    - listitem:
      - link "All Courses":
        - /url: /en/courses
    - listitem:
      - link "🎁 Gift cards":
        - /url: /en/gift-cards
    - listitem:
      - link "Success Stories":
        - /url: /en/success-stories
    - listitem:
      - link "Trainers":
        - /url: /en/trainers
    - listitem:
      - link "Photo Gallery":
        - /url: /en/gallery
  - heading "Community" [level=3]
  - list:
    - listitem:
      - link "Jobs & Projects":
        - /url: /en/community
    - listitem:
      - link "Mentors":
        - /url: /en/mentors
    - listitem:
      - link "Digital Market":
        - /url: /en/marketplace
    - listitem:
      - link "AI Tools":
        - /url: /en/marketplace?category=Digital%20AI%20Tools
    - listitem:
      - link "Forum":
        - /url: /en/forum
    - listitem:
      - link "CDC Studio":
        - /url: /en/agency
    - listitem:
      - link "Case Studies":
        - /url: /en/cases
  - heading "Help" [level=3]
  - list:
    - listitem:
      - link "Video Tutorials":
        - /url: /en/tutorials
    - listitem:
      - link "About Us":
        - /url: /en/about
    - listitem:
      - link "Get in Touch":
        - /url: /en/contact
  - heading "Legal" [level=3]
  - list:
    - listitem:
      - link "Privacy Policy":
        - /url: /en/privacy
    - listitem:
      - link "Terms & Conditions":
        - /url: /en/terms
    - listitem:
      - link "Refund Policy":
        - /url: /en/refund-policy
  - heading "Follow Us" [level=3]
  - link "Facebook":
    - /url: https://www.facebook.com/cdc.digitalcareers
  - link "Instagram":
    - /url: https://www.instagram.com/digitalcareers1/
  - link "TikTok":
    - /url: https://www.tiktok.com/@digitalcareers.geo
  - link "LinkedIn":
    - /url: https://www.linkedin.com/in/cdc-%E1%83%AA%E1%83%98%E1%83%A4%E1%83%A0%E1%83%A3%E1%83%9A%E1%83%98-%E1%83%9E%E1%83%A0%E1%83%9D%E1%83%A4%E1%83%94%E1%83%A1%E1%83%98%E1%83%91%E1%83%98%E1%83%A1-%E1%83%AA%E1%83%94%E1%83%9C%E1%83%A2%E1%83%A0%E1%83%98-473404428/
  - text: We Accept VISA Mastercard BOG Pay
  - paragraph: ა(ა)იპ ციფრული პროფესიების ცენტრი / Digital Careers Center (CDC Georgia)
  - paragraph: "ს/კ / ID Code: 438737743"
  - paragraph: © 2026 Digital Careers Center (CDC Georgia). All rights reserved.
- button "Scroll to top":
  - img
- alert
```

# Test source

```ts
  86  |   await apiJson(api, 'post', `/childrens-books/${id}/character-approval`);
  87  |   return id;
  88  | }
  89  | 
  90  | // The reader opens on the front cover like a real book; "Open the book"
  91  | // turns to the title page and "Next" to the first story page.
  92  | async function openAuthenticatedBook(page: Page, bookId: string) {
  93  |   await page.goto(`/en/dashboard/tools/childrens-book/reader/${bookId}`);
  94  |   await expect(page.getByText('Cover', { exact: true })).toBeVisible({ timeout: 15000 });
  95  |   await page.getByRole('button', { name: 'Open the book' }).click();
  96  |   await expect(page.getByText('Title page', { exact: true })).toBeVisible();
  97  |   await page.getByRole('button', { name: 'Next' }).click();
  98  |   await expect(page.getByText(/^Page 1 \/ \d+$/).first()).toBeVisible({ timeout: 15000 });
  99  | }
  100 | 
  101 | test('children book 5/10/20-page mock golden paths, audio revision, and reader UI', async ({ page }) => {
  102 |   test.setTimeout(180000);
  103 |   const books: Array<{ id: string; book: any; narrationCount: number }> = [];
  104 |   const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  105 |   const pageErrors: string[] = [];
  106 |   page.on('pageerror', (error) => pageErrors.push(error.message));
  107 | 
  108 |   try {
  109 |     await page.goto('/en/dashboard/tools/childrens-book');
  110 |     await expect(page.getByRole('heading', { name: /Children|Book/i }).first()).toBeVisible({ timeout: 15000 });
  111 |     const acceptCookies = page.getByRole('button', { name: 'Accept All' });
  112 |     if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click();
  113 |     const token = await page.evaluate(() => localStorage.getItem('cdc_access_token'));
  114 |     expect(token).toBeTruthy();
  115 |     await api.dispose();
  116 |     const authenticatedApi = await playwrightRequest.newContext({
  117 |       baseURL: apiBaseUrl,
  118 |       extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  119 |     });
  120 | 
  121 |     const runId = Date.now().toString();
  122 |     const wizardTitle = `QA ${runId} UI Wizard Book`;
  123 |     const quietTitle = `QA ${runId} 5 Page Quiet Story`;
  124 |     const audioTitle = `QA ${runId} 10 Page Audio Story`;
  125 |     const longAudioTitle = `QA ${runId} 20 Page Audio Story`;
  126 |     const upsellTitle = `QA ${runId} Audio Upsell Story`;
  127 | 
  128 |     await page.getByText('5 pages', { exact: true }).click();
  129 |     await page.getByPlaceholder("e.g. Mimi's Great Adventure").fill(wizardTitle);
  130 |     // The create form is a 4-step wizard: book → hero → extras → style.
  131 |     await page.getByRole('button', { name: 'Next' }).click();
  132 |     await page.getByPlaceholder('e.g. Mimi', { exact: true }).fill('Milo');
  133 |     await page.getByRole('button', { name: 'Next' }).click();
  134 |     await page.getByRole('button', { name: 'Skip' }).click();
  135 |     await page.getByRole('button', { name: 'Create Book' }).click();
  136 |     await expect(page.getByRole('heading', { name: wizardTitle })).toBeVisible();
  137 |     const wizardBookId = new URL(page.url()).searchParams.get('bookId');
  138 |     expect(wizardBookId).toBeTruthy();
  139 |     const wizardBook = (await apiJson(authenticatedApi, 'get', `/childrens-books/${wizardBookId}`)).data;
  140 |     expect(wizardBook.pageCount).toBe(5);
  141 |     expect(wizardBook.priceGel).toBe(500);
  142 |     expect(wizardBook.audioAddOnPurchased).toBe(false);
  143 |     await page.goto('/en/dashboard/tools/childrens-book');
  144 | 
  145 |     books.push(await createBookPath(authenticatedApi, 5, false, quietTitle));
  146 |     books.push(await createBookPath(authenticatedApi, 10, true, audioTitle));
  147 |     books.push(await createBookPath(authenticatedApi, 20, true, longAudioTitle));
  148 |     const upsellBookId = await createApprovedAudioUpsellBook(authenticatedApi, upsellTitle);
  149 |     expect(books.map(({ narrationCount }) => narrationCount)).toEqual([0, 10, 20]);
  150 | 
  151 |     const audioBook = books[1];
  152 |     const image = await authenticatedApi.get(`childrens-books/${audioBook.id}/page/1/image`);
  153 |     expect(image.ok()).toBeTruthy();
  154 |     expect(image.headers()['content-type']).toContain('image/png');
  155 |     const audio = await authenticatedApi.get(`childrens-books/${audioBook.id}/audio/page/1`);
  156 |     expect(audio.ok()).toBeTruthy();
  157 |     expect(audio.headers()['content-type']).toContain('audio/wav');
  158 |     const firstPageAudio = await audio.body();
  159 |     expect(firstPageAudio.subarray(0, 4).toString('ascii')).toBe('RIFF');
  160 |     const secondPageAudio = await authenticatedApi.get(`childrens-books/${audioBook.id}/audio/page/2`);
  161 |     expect((await secondPageAudio.body()).equals(firstPageAudio)).toBe(false);
  162 | 
  163 |     const before = (await apiJson(authenticatedApi, 'get', `/childrens-books/${audioBook.id}/audio/status`)).data.artifacts;
  164 |     const originalRefs = new Map(before.filter((artifact: any) => artifact.revisionVersion === 0).map((artifact: any) => [artifact.pageNumber, artifact.id]));
  165 |     const revisionResponse = await authenticatedApi.post(`childrens-books/${audioBook.id}/revision`, {
  166 |       data: { pageNumber: 5, note: 'Make the lantern brighter' },
  167 |     });
  168 |     const revisionBody = await revisionResponse.json();
  169 |     expect(revisionResponse.ok(), JSON.stringify(revisionBody)).toBeTruthy();
  170 |     expect(revisionBody.data.revisionUsed).toBe(true);
  171 |     const after = (await apiJson(authenticatedApi, 'get', `/childrens-books/${audioBook.id}/audio/status`)).data.artifacts;
  172 |     const revisedArtifacts = after.filter((artifact: any) => artifact.revisionVersion === 1);
  173 |     expect(revisedArtifacts.map((artifact: any) => artifact.pageNumber)).toEqual([5]);
  174 |     for (const artifact of after.filter((entry: any) => entry.revisionVersion === 0)) {
  175 |       expect(artifact.id).toBe(originalRefs.get(artifact.pageNumber));
  176 |     }
  177 |     const secondRevision = await authenticatedApi.post(`childrens-books/${audioBook.id}/revision`, { data: { pageNumber: 6 } });
  178 |     expect(secondRevision.status()).toBe(400);
  179 |     await apiJson(authenticatedApi, 'post', `/childrens-books/${audioBook.id}/pdf`);
  180 |     const revisedPdfResponse = await authenticatedApi.get(`childrens-books/${audioBook.id}/pdf/download`);
  181 |     const revisedPdf = await PDFDocument.load(await revisedPdfResponse.body());
  182 |     expect(revisedPdf.getPageCount()).toBe(10 + 3);
  183 | 
  184 |     await page.setViewportSize({ width: 1440, height: 900 });
  185 |     await page.goto(`/en/dashboard/tools/childrens-book?bookId=${upsellBookId}`);
> 186 |     await expect(page.getByText('Book: 5 GEL · Audio: 0 GEL · Total: 5 GEL', { exact: true })).toBeVisible();
      |                                                                                                ^ Error: expect(locator).toBeVisible() failed
  187 |     await page.screenshot({ path: 'test-results/book-audio-upsell-desktop.png', fullPage: true });
  188 |     await page.getByRole('button', { name: 'Add for 10 GEL' }).click();
  189 |     await expect(page.getByText('Book: 5 GEL · Audio: 5 GEL · Total: 10 GEL', { exact: true })).toBeVisible();
  190 |     await expect(page.getByRole('button', { name: 'devSimulateButton' })).toHaveCount(0);
  191 |     // Preview comes before payment: no Pay button until it is confirmed.
  192 |     await expect(page.getByRole('heading', { name: 'Book preview' })).toBeVisible();
  193 |     // (CI runs with dev payment simulation on, so the payment step shows the
  194 |     // simulate button instead of the real Pay button.)
  195 |     await expect(page.getByRole('button', { name: 'Simulate Payment (dev only)' })).toHaveCount(0);
  196 |     await page.getByRole('button', { name: 'Looks good, continue to payment' }).click();
  197 |     await expect(page.getByRole('button', { name: 'Simulate Payment (dev only)' })).toBeVisible();
  198 | 
  199 |     await page.setViewportSize({ width: 375, height: 812 });
  200 |     const wizardMobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  201 |     expect(wizardMobileWidth).toBeLessThanOrEqual(375);
  202 |     await page.screenshot({ path: 'test-results/book-audio-upsell-mobile.png', fullPage: true });
  203 |     await page.goto('/en/dashboard/tools/childrens-book');
  204 |     const mobileAudioCard = page.locator('article').filter({ hasText: audioTitle });
  205 |     await expect(mobileAudioCard.getByRole('button', { name: 'Listen' })).toBeVisible();
  206 |     const myBooksMobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  207 |     expect(myBooksMobileWidth).toBeLessThanOrEqual(375);
  208 | 
  209 |     await page.setViewportSize({ width: 1440, height: 900 });
  210 |     await page.goto('/en/dashboard/tools/childrens-book');
  211 |     const quietCard = page.locator('article').filter({ hasText: quietTitle });
  212 |     const audioCard = page.locator('article').filter({ hasText: audioTitle });
  213 |     await expect(quietCard.getByRole('button', { name: 'Read' })).toBeVisible();
  214 |     await expect(quietCard.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  215 |     await expect(quietCard.getByRole('button', { name: 'Listen' })).toHaveCount(0);
  216 |     await expect(audioCard.getByText('Audio Story', { exact: true })).toBeVisible();
  217 |     await expect(audioCard.getByRole('button', { name: 'Listen' })).toBeVisible();
  218 | 
  219 |     const downloadPromise = page.waitForEvent('download');
  220 |     await audioCard.getByRole('button', { name: 'Download PDF' }).click();
  221 |     const download = await downloadPromise;
  222 |     expect(download.suggestedFilename()).toContain(audioTitle);
  223 | 
  224 |     await openAuthenticatedBook(page, audioBook.id);
  225 |     await expect(page.getByText('Page 1 / 10', { exact: true }).first()).toBeVisible();
  226 |     const readerImage = page.locator('img[alt*="page 1"]');
  227 |     await expect(readerImage).toBeVisible();
  228 |     await expect.poll(() => readerImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1024);
  229 |     await page.screenshot({ path: 'test-results/book-reader-desktop.png', fullPage: true });
  230 |     const readerAudio = page.locator('audio');
  231 |     expect(await readerAudio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  232 |     await expect(page.getByRole('button', { name: 'Play Full Story' })).toBeEnabled();
  233 |     await page.getByRole('button', { name: 'Next' }).click();
  234 |     await expect(page.getByText('Page 2 / 10', { exact: true }).first()).toBeVisible();
  235 |     await page.getByRole('button', { name: 'Previous' }).click();
  236 |     await expect(page.getByText('Page 1 / 10', { exact: true }).first()).toBeVisible();
  237 |     await page.getByRole('button', { name: 'Play', exact: true }).click();
  238 |     await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  239 |     await expect.poll(async () => Number(await page.getByRole('progressbar', { name: 'Audio progress' }).getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  240 |     await page.getByRole('button', { name: 'Pause', exact: true }).click();
  241 |     await page.getByRole('button', { name: 'Play Full Story' }).click();
  242 |     // Read-aloud turns each page itself after its narration (plus the page-turn animation).
  243 |     await expect(page.getByText('Page 10 / 10', { exact: true }).first()).toBeVisible({ timeout: 60000 });
  244 | 
  245 |     await openAuthenticatedBook(page, books[0].id);
  246 |     await expect(page.getByRole('region', { name: 'Audio controls' })).toHaveCount(0);
  247 | 
  248 |     await page.setViewportSize({ width: 375, height: 812 });
  249 |     await openAuthenticatedBook(page, audioBook.id);
  250 |     const mobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  251 |     expect(mobileWidth).toBeLessThanOrEqual(375);
  252 |     await page.screenshot({ path: 'test-results/book-reader-mobile.png', fullPage: true });
  253 |     await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
  254 |     await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  255 | 
  256 |     await page.setViewportSize({ width: 1440, height: 900 });
  257 |     await page.goto(`/en/dashboard/tools/childrens-book?bookId=${audioBook.id}`);
  258 |     await expect(page.getByText('Generate audio story')).toHaveCount(0);
  259 |     const desktopWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  260 |     expect(desktopWidth).toBeLessThanOrEqual(1440);
  261 |     await expect(page.getByText(/statusValue\./)).toHaveCount(0);
  262 |     expect(pageErrors).toEqual([]);
  263 | 
  264 |     await authenticatedApi.dispose();
  265 |   } finally {
  266 |     await api.dispose();
  267 |   }
  268 | });
```