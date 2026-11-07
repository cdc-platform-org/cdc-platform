# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: childrens-book-audio.spec.ts >> children book 5/10/20-page mock golden paths, audio revision, and reader UI
- Location: e2e/childrens-book-audio.spec.ts:90:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "FINAL_READY"
Received: "COMPLETED"

Call Log:
- Timeout 30000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e3]:
    - status [ref=f1e4]:
      - generic [ref=f1e5]:
        - paragraph [ref=f1e6]:
          - text: 🚀 CDC Platform is currently in Beta mode. If you encounter any issues or technical hiccups, please contact us at
          - link "contact@cdc.org.ge" [ref=f1e7] [cursor=pointer]:
            - /url: mailto:contact@cdc.org.ge
        - button "Dismiss" [ref=f1e8] [cursor=pointer]
    - generic [ref=f1e12]:
      - navigation [ref=f1e13]:
        - generic [ref=f1e14]:
          - link "CDC" [ref=f1e16] [cursor=pointer]:
            - /url: /en
            - img "CDC" [ref=f1e17]
          - generic [ref=f1e20]:
            - button "Search" [ref=f1e22] [cursor=pointer]
            - button "Change language" [ref=f1e28] [cursor=pointer]:
              - generic [ref=f1e36]: en
            - button "Toggle dark mode" [ref=f1e37] [cursor=pointer]
            - button "Notifications" [ref=f1e41] [cursor=pointer]:
              - generic [ref=f1e45]: "1"
            - button "Q" [ref=f1e47] [cursor=pointer]
            - button "Toggle menu" [ref=f1e50] [cursor=pointer]
      - main [ref=f1e52]:
        - button "Back" [ref=f1e53] [cursor=pointer]
        - generic [ref=f1e56]:
          - generic [ref=f1e59]:
            - heading "Custom AI Children's Book" [level=1] [ref=f1e60]
            - paragraph [ref=f1e61]: Design a one-of-a-kind illustrated storybook starring your child
          - link "Gift this" [ref=f1e62] [cursor=pointer]:
            - /url: /en/gift-cards?amount=20&item=Custom+AI+children%27s+book&url=%2Fdashboard%2Ftools%2Fchildrens-book&design=kids
        - heading "My Books" [level=2] [ref=f1e67]
        - generic [ref=f1e68]:
          - article [ref=f1e69]:
            - generic [ref=f1e70]: QA 1794074438192 5 Page Quiet Story
            - generic [ref=f1e71]: Generating character preview
            - generic [ref=f1e72]: 5 pages · 5 GEL
            - generic [ref=f1e73]: 11/7/2026
            - generic [ref=f1e74]:
              - button "Read" [ref=f1e75] [cursor=pointer]
              - button "Download PDF" [disabled] [ref=f1e76]
          - article [ref=f1e80]:
            - generic [ref=f1e81]: QA 1794074438192 UI Wizard Book
            - generic [ref=f1e82]: Draft
            - generic [ref=f1e83]: 5 pages · 5 GEL
            - generic [ref=f1e84]: 11/7/2026
            - generic [ref=f1e85]:
              - button "Read" [ref=f1e86] [cursor=pointer]
              - button "Download PDF" [disabled] [ref=f1e87]
          - article [ref=f1e91]:
            - generic [ref=f1e92]: QA 1794074436219 5 Page Quiet Story
            - generic [ref=f1e93]: Completed
            - generic [ref=f1e94]: 5 pages · 5 GEL
            - generic [ref=f1e95]: 11/7/2026
            - generic [ref=f1e96]:
              - button "Read" [ref=f1e97] [cursor=pointer]
              - button "Download PDF" [ref=f1e98] [cursor=pointer]
          - article [ref=f1e102]:
            - generic [ref=f1e103]: QA 1794074436219 UI Wizard Book
            - generic [ref=f1e104]: Draft
            - generic [ref=f1e105]: 5 pages · 5 GEL
            - generic [ref=f1e106]: 11/7/2026
            - generic [ref=f1e107]:
              - button "Read" [ref=f1e108] [cursor=pointer]
              - button "Download PDF" [disabled] [ref=f1e109]
          - article [ref=f1e113]:
            - generic [ref=f1e114]: QA 1794074433213 5 Page Quiet Story
            - generic [ref=f1e115]: Completed
            - generic [ref=f1e116]: 5 pages · 5 GEL
            - generic [ref=f1e117]: 11/7/2026
            - generic [ref=f1e118]:
              - button "Read" [ref=f1e119] [cursor=pointer]
              - button "Download PDF" [ref=f1e120] [cursor=pointer]
          - article [ref=f1e124]:
            - generic [ref=f1e125]: QA 1794074433213 UI Wizard Book
            - generic [ref=f1e126]: Draft
            - generic [ref=f1e127]: 5 pages · 5 GEL
            - generic [ref=f1e128]: 11/7/2026
            - generic [ref=f1e129]:
              - button "Read" [ref=f1e130] [cursor=pointer]
              - button "Download PDF" [disabled] [ref=f1e131]
        - generic [ref=f1e135]:
          - heading "Create a New Book" [level=2] [ref=f1e136]
          - paragraph [ref=f1e140]: Three short steps. You will see the text and the character before paying.
          - generic [ref=f1e141]:
            - heading "1 Book" [level=3] [ref=f1e142]:
              - generic [ref=f1e143]: "1"
              - text: Book
            - paragraph [ref=f1e144]: Length, title and language.
            - generic [ref=f1e145]:
              - generic [ref=f1e146]:
                - generic [ref=f1e147]: Book length
                - generic [ref=f1e148]:
                  - button "5 pages 5 GEL" [ref=f1e149] [cursor=pointer]:
                    - generic [ref=f1e150]: 5 pages
                    - generic [ref=f1e151]: 5 GEL
                  - button "10 pages 10 GEL" [ref=f1e152] [cursor=pointer]:
                    - generic [ref=f1e153]: 10 pages
                    - generic [ref=f1e154]: 10 GEL
                  - button "15 pages 15 GEL" [ref=f1e155] [cursor=pointer]:
                    - generic [ref=f1e156]: 15 pages
                    - generic [ref=f1e157]: 15 GEL
                  - button "20 pages 20 GEL" [ref=f1e158] [cursor=pointer]:
                    - generic [ref=f1e159]: 20 pages
                    - generic [ref=f1e160]: 20 GEL
              - generic [ref=f1e161]:
                - generic [ref=f1e162]: Book title
                - textbox "e.g. Mimi's Great Adventure" [ref=f1e163]
              - generic [ref=f1e164]:
                - generic [ref=f1e165]: Book language
                - combobox [ref=f1e166]:
                  - option "English" [selected]
                  - option "ქართული"
          - generic [ref=f1e167]:
            - heading "2 Main character" [level=3] [ref=f1e168]:
              - generic [ref=f1e169]: "2"
              - text: Main character
            - paragraph [ref=f1e170]: The more you tell us about the child, the more personal the story.
            - generic [ref=f1e171]:
              - generic [ref=f1e172]:
                - generic [ref=f1e173]: Character's name
                - textbox "e.g. Mimi" [ref=f1e174]
              - generic [ref=f1e175]:
                - generic [ref=f1e176]: Age (optional)
                - spinbutton [ref=f1e177]
              - generic [ref=f1e178]:
                - generic [ref=f1e179]: Traits (comma-separated)
                - textbox "e.g. brave, curious, kind" [ref=f1e180]
              - generic [ref=f1e181]:
                - generic [ref=f1e182]: Favorite thing (optional)
                - textbox [ref=f1e183]
              - generic [ref=f1e184]:
                - generic [ref=f1e185]: Visual description (optional)
                - textbox "e.g. curly brown hair, green eyes, freckles, loves a yellow raincoat" [ref=f1e186]
              - generic [ref=f1e188]:
                - generic [ref=f1e189]: Photo of the main character (optional)
                - paragraph [ref=f1e190]: Upload a clear photo of your child's face and we'll draw the character to look like them.
                - generic [ref=f1e191] [cursor=pointer]:
                  - checkbox "I confirm I am the child's parent or legal guardian and agree that this photo is used to create the book's illustrations." [ref=f1e192]
                  - generic [ref=f1e193]: I confirm I am the child's parent or legal guardian and agree that this photo is used to create the book's illustrations.
                - button "Upload photo" [ref=f1e199] [cursor=pointer]
                - paragraph [ref=f1e200]: JPG, PNG or WebP, up to 8MB. The photo is stored privately and location data is removed. To draw the character it is sent to an AI image service (Azure OpenAI) and used for nothing else. It is deleted automatically as soon as you approve the character, and you can remove it at any time before that.
              - generic [ref=f1e202]:
                - generic [ref=f1e203]: Brothers and sisters (optional)
                - paragraph [ref=f1e209]: Add up to 3 siblings. They will star in the same story and appear on the pictures together with the main character.
                - button "Add a brother or sister" [ref=f1e210] [cursor=pointer]
              - generic [ref=f1e212]:
                - generic [ref=f1e213]: Other characters in the story (optional)
                - textbox "e.g. little brother Luka, grandma Eteri, a dog named Bobi" [ref=f1e214]
              - generic [ref=f1e215]:
                - generic [ref=f1e216]: Dedication (optional)
                - textbox "For my little explorer..." [ref=f1e217]
          - generic [ref=f1e218]:
            - heading "3 Illustration style" [level=3] [ref=f1e219]:
              - generic [ref=f1e220]: "3"
              - text: Illustration style
            - paragraph [ref=f1e221]: See a sample and choose how the whole book will be drawn.
            - radiogroup "Illustration style" [ref=f1e222]:
              - radio "Storybook Watercolor Storybook Watercolor Soft colours and watercolour texture" [checked] [ref=f1e223] [cursor=pointer]:
                - img "Storybook Watercolor" [ref=f1e225]
                - generic [ref=f1e226]:
                  - generic [ref=f1e227]: Storybook Watercolor
                  - generic [ref=f1e228]: Soft colours and watercolour texture
              - radio "Modern 3D Modern 3D A 3D world like an animated film" [ref=f1e232] [cursor=pointer]:
                - img "Modern 3D" [ref=f1e234]
                - generic [ref=f1e235]:
                  - generic [ref=f1e236]: Modern 3D
                  - generic [ref=f1e237]: A 3D world like an animated film
              - radio "Soft Digital Painting Soft Digital Painting Gentle pastel digital painting" [ref=f1e238] [cursor=pointer]:
                - img "Soft Digital Painting" [ref=f1e240]
                - generic [ref=f1e241]:
                  - generic [ref=f1e242]: Soft Digital Painting
                  - generic [ref=f1e243]: Gentle pastel digital painting
              - radio "Cute Cartoon Cute Cartoon Bright colours and bold outlines" [ref=f1e244] [cursor=pointer]:
                - img "Cute Cartoon" [ref=f1e246]
                - generic [ref=f1e247]:
                  - generic [ref=f1e248]: Cute Cartoon
                  - generic [ref=f1e249]: Bright colours and bold outlines
              - radio "Magical Fantasy Magical Fantasy Magical light and sparkle" [ref=f1e250] [cursor=pointer]:
                - img "Magical Fantasy" [ref=f1e252]
                - generic [ref=f1e253]:
                  - generic [ref=f1e254]: Magical Fantasy
                  - generic [ref=f1e255]: Magical light and sparkle
              - radio "Classic Illustrated Classic Illustrated The look of a classic storybook" [ref=f1e256] [cursor=pointer]:
                - img "Classic Illustrated" [ref=f1e258]
                - generic [ref=f1e259]:
                  - generic [ref=f1e260]: Classic Illustrated
                  - generic [ref=f1e261]: The look of a classic storybook
          - generic [ref=f1e262]:
            - generic [ref=f1e263]: Promo code (optional)
            - textbox "Promo code (optional)" [ref=f1e264]:
              - /placeholder: e.g. SALE20
            - paragraph [ref=f1e265]: The discount is applied automatically at the payment step.
          - button "Create Book" [disabled] [ref=f1e266]
      - contentinfo [ref=f1e267]:
        - generic [ref=f1e271]:
          - generic [ref=f1e272]:
            - generic [ref=f1e273]:
              - generic [ref=f1e274]: CDC
              - paragraph [ref=f1e278]: Teaching digital professions in Guria — supported by HEKS/EPER Georgia.
              - heading "Follow Us" [level=3] [ref=f1e279]
              - generic [ref=f1e280]:
                - link "Facebook" [ref=f1e281] [cursor=pointer]:
                  - /url: https://www.facebook.com/cdc.digitalcareers
                - link "Instagram" [ref=f1e284] [cursor=pointer]:
                  - /url: https://www.instagram.com/digitalcareers1/
                - link "TikTok" [ref=f1e289] [cursor=pointer]:
                  - /url: https://www.tiktok.com/@digitalcareers.geo
                - link "LinkedIn" [ref=f1e292] [cursor=pointer]:
                  - /url: https://www.linkedin.com/in/cdc-%E1%83%AA%E1%83%98%E1%83%A4%E1%83%A0%E1%83%A3%E1%83%9A%E1%83%98-%E1%83%9E%E1%83%A0%E1%83%9D%E1%83%A4%E1%83%94%E1%83%A1%E1%83%98%E1%83%91%E1%83%98%E1%83%A1-%E1%83%AA%E1%83%94%E1%83%9C%E1%83%A2%E1%83%A0%E1%83%98-473404428/
            - generic [ref=f1e295]:
              - heading "Courses" [level=3] [ref=f1e296]
              - list [ref=f1e297]:
                - listitem [ref=f1e298]:
                  - link "All Courses" [ref=f1e299] [cursor=pointer]:
                    - /url: /en/courses
                - listitem [ref=f1e300]:
                  - link "🎁 Gift cards" [ref=f1e301] [cursor=pointer]:
                    - /url: /en/gift-cards
                - listitem [ref=f1e302]:
                  - link "Success Stories" [ref=f1e303] [cursor=pointer]:
                    - /url: /en/success-stories
                - listitem [ref=f1e304]:
                  - link "Trainers" [ref=f1e305] [cursor=pointer]:
                    - /url: /en/trainers
                - listitem [ref=f1e306]:
                  - link "Photo Gallery" [ref=f1e307] [cursor=pointer]:
                    - /url: /en/gallery
            - generic [ref=f1e308]:
              - heading "Community" [level=3] [ref=f1e309]
              - list [ref=f1e310]:
                - listitem [ref=f1e311]:
                  - link "Jobs & Projects" [ref=f1e312] [cursor=pointer]:
                    - /url: /en/community
                - listitem [ref=f1e313]:
                  - link "Mentors" [ref=f1e314] [cursor=pointer]:
                    - /url: /en/mentors
                - listitem [ref=f1e315]:
                  - link "Marketplace" [ref=f1e316] [cursor=pointer]:
                    - /url: /en/marketplace
                - listitem [ref=f1e317]:
                  - link "Forum" [ref=f1e318] [cursor=pointer]:
                    - /url: /en/forum
                - listitem [ref=f1e319]:
                  - link "CDC Studio" [ref=f1e320] [cursor=pointer]:
                    - /url: /en/agency
                - listitem [ref=f1e321]:
                  - link "Case Studies" [ref=f1e322] [cursor=pointer]:
                    - /url: /en/cases
            - generic [ref=f1e323]:
              - heading "Help" [level=3] [ref=f1e324]
              - list [ref=f1e325]:
                - listitem [ref=f1e326]:
                  - link "Video Tutorials" [ref=f1e327] [cursor=pointer]:
                    - /url: /en/tutorials
                - listitem [ref=f1e328]:
                  - link "About Us" [ref=f1e329] [cursor=pointer]:
                    - /url: /en/about
                - listitem [ref=f1e330]:
                  - link "Get in Touch" [ref=f1e331] [cursor=pointer]:
                    - /url: /en/contact
                - listitem [ref=f1e332]:
                  - link "contact@cdc.org.ge" [ref=f1e333] [cursor=pointer]:
                    - /url: mailto:contact@cdc.org.ge
                - listitem [ref=f1e334]:
                  - link "+995 551 14 14 11" [ref=f1e335] [cursor=pointer]:
                    - /url: tel:+995551141411
            - generic [ref=f1e336]:
              - heading "Legal" [level=3] [ref=f1e337]
              - list [ref=f1e338]:
                - listitem [ref=f1e339]:
                  - link "Privacy Policy" [ref=f1e340] [cursor=pointer]:
                    - /url: /en/privacy
                - listitem [ref=f1e341]:
                  - link "Terms & Conditions" [ref=f1e342] [cursor=pointer]:
                    - /url: /en/terms
                - listitem [ref=f1e343]:
                  - link "Refund Policy" [ref=f1e344] [cursor=pointer]:
                    - /url: /en/refund-policy
          - generic [ref=f1e346]:
            - generic [ref=f1e347]: We Accept
            - generic [ref=f1e348]:
              - generic [ref=f1e349]: VISA
              - generic [ref=f1e350]: Mastercard
              - generic [ref=f1e351]: BOG Pay
          - generic [ref=f1e353]:
            - paragraph [ref=f1e354]: ა(ა)იპ ციფრული პროფესიების ცენტრი / Digital Careers Center (CDC Georgia)
            - paragraph [ref=f1e355]: "ს/კ / ID Code: 438737743"
          - paragraph [ref=f1e357]: © 2026 Digital Careers Center (CDC Georgia). All rights reserved.
    - button "Scroll to top"
  - alert [ref=f1e358]
```

# Test source

```ts
  1   | import { createRequire } from 'node:module';
  2   | import path from 'node:path';
  3   | import { expect, request as playwrightRequest, test, APIRequestContext, Page } from '@playwright/test';
  4   | import { AUTH_STATE_PATH } from './global-setup';
  5   | 
  6   | const apiBaseUrl = process.env.BOOK_API_URL || 'http://localhost:4001/api/';
  7   | const backendRequire = createRequire(path.resolve(process.cwd(), '../Backend/package.json'));
  8   | const { PDFDocument } = backendRequire('pdf-lib');
  9   | 
  10  | test.use({ storageState: AUTH_STATE_PATH });
  11  | 
  12  | async function apiJson(api: APIRequestContext, method: 'get' | 'post' | 'patch', route: string, data?: unknown) {
  13  |   const response = await api[method](route.replace(/^\//, ''), data === undefined ? undefined : { data });
  14  |   expect(response.ok(), `${method.toUpperCase()} ${route} returned ${response.status()}`).toBeTruthy();
  15  |   return response.json();
  16  | }
  17  | 
  18  | async function createBookPath(api: APIRequestContext, pageCount: number, withAudio: boolean, title: string) {
  19  |   const created = await apiJson(api, 'post', '/childrens-books', {
  20  |     language: 'EN',
  21  |     title,
  22  |     pageCount,
  23  |     character: { name: 'Milo', age: 7, traits: ['curious', 'kind'] },
  24  |   });
  25  |   const id = created.data.id as string;
  26  |   await apiJson(api, 'post', `/childrens-books/${id}/story-plan`);
  27  |   await apiJson(api, 'post', `/childrens-books/${id}/story-text/approve`);
  28  |   await apiJson(api, 'post', `/childrens-books/${id}/character-preview`);
  29  |   await apiJson(api, 'post', `/childrens-books/${id}/character-approval`);
  30  |   if (withAudio) await apiJson(api, 'patch', `/childrens-books/${id}/audio-upgrade`, { audioAddOnPurchased: true });
  31  | 
  32  |   const beforePayment = (await apiJson(api, 'get', `/childrens-books/${id}`)).data;
  33  |   expect(beforePayment.priceGel).toBe(pageCount * 100);
  34  |   expect(beforePayment.totalPriceGel).toBe(pageCount * 100 + (withAudio ? 500 : 0));
  35  | 
  36  |   // The buyer must confirm the book preview before paying.
  37  |   await apiJson(api, 'post', `/childrens-books/${id}/preview-confirm`);
  38  |   // Payment completion starts final generation in the background; the
  39  |   // client only polls its status.
  40  |   await apiJson(api, 'post', `/childrens-books/${id}/payment/dev-simulate`);
  41  |   await expect
  42  |     .poll(async () => (await apiJson(api, 'get', `/childrens-books/${id}/final-generation/status`)).data.status, { timeout: 30_000 })
> 43  |     .toBe('FINAL_READY');
      |      ^ Error: expect(received).toBe(expected) // Object.is equality
  44  |   const generation = (await apiJson(api, 'get', `/childrens-books/${id}/final-generation/status`)).data;
  45  |   expect(generation.pages.filter((p: { accepted: boolean }) => p.accepted)).toHaveLength(pageCount);
  46  | 
  47  |   let narrationCount = 0;
  48  |   if (withAudio) {
  49  |     const narration = await apiJson(api, 'post', `/childrens-books/${id}/audio/generate`);
  50  |     narrationCount = narration.data.artifacts.length;
  51  |     expect(narrationCount).toBe(pageCount);
  52  |   } else {
  53  |     const status = await apiJson(api, 'get', `/childrens-books/${id}/audio/status`);
  54  |     expect(status.data.artifacts).toHaveLength(0);
  55  |   }
  56  | 
  57  |   await apiJson(api, 'post', `/childrens-books/${id}/pdf`);
  58  |   const pdfResponse = await api.get(`childrens-books/${id}/pdf/download`);
  59  |   expect(pdfResponse.ok()).toBeTruthy();
  60  |   const pdf = await PDFDocument.load(await pdfResponse.body());
  61  |   expect(pdf.getPageCount()).toBe(pageCount);
  62  | 
  63  |   const book = (await apiJson(api, 'get', `/childrens-books/${id}`)).data;
  64  |   expect(['FINAL_READY', 'COMPLETED']).toContain(book.status);
  65  |   expect(book.pages).toHaveLength(pageCount);
  66  |   expect(book.pdfStatus).toBe('CURRENT');
  67  |   return { id, book, narrationCount };
  68  | }
  69  | 
  70  | async function createApprovedAudioUpsellBook(api: APIRequestContext, title: string) {
  71  |   const created = await apiJson(api, 'post', '/childrens-books', {
  72  |     language: 'EN',
  73  |     title,
  74  |     pageCount: 5,
  75  |     character: { name: 'Milo', age: 7 },
  76  |   });
  77  |   const id = created.data.id as string;
  78  |   await apiJson(api, 'post', `/childrens-books/${id}/story-plan`);
  79  |   await apiJson(api, 'post', `/childrens-books/${id}/story-text/approve`);
  80  |   await apiJson(api, 'post', `/childrens-books/${id}/character-preview`);
  81  |   await apiJson(api, 'post', `/childrens-books/${id}/character-approval`);
  82  |   return id;
  83  | }
  84  | 
  85  | async function openAuthenticatedBook(page: Page, bookId: string) {
  86  |   await page.goto(`/en/dashboard/tools/childrens-book/reader/${bookId}`);
  87  |   await expect(page.getByText(/^Page 1 \/ \d+$/).first()).toBeVisible({ timeout: 15000 });
  88  | }
  89  | 
  90  | test('children book 5/10/20-page mock golden paths, audio revision, and reader UI', async ({ page }) => {
  91  |   test.setTimeout(90000);
  92  |   const books: Array<{ id: string; book: any; narrationCount: number }> = [];
  93  |   const api = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
  94  |   const pageErrors: string[] = [];
  95  |   page.on('pageerror', (error) => pageErrors.push(error.message));
  96  | 
  97  |   try {
  98  |     await page.goto('/en/dashboard/tools/childrens-book');
  99  |     await expect(page.getByRole('heading', { name: /Children|Book/i }).first()).toBeVisible({ timeout: 15000 });
  100 |     const acceptCookies = page.getByRole('button', { name: 'Accept All' });
  101 |     if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click();
  102 |     const token = await page.evaluate(() => localStorage.getItem('cdc_access_token'));
  103 |     expect(token).toBeTruthy();
  104 |     await api.dispose();
  105 |     const authenticatedApi = await playwrightRequest.newContext({
  106 |       baseURL: apiBaseUrl,
  107 |       extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  108 |     });
  109 | 
  110 |     const runId = Date.now().toString();
  111 |     const wizardTitle = `QA ${runId} UI Wizard Book`;
  112 |     const quietTitle = `QA ${runId} 5 Page Quiet Story`;
  113 |     const audioTitle = `QA ${runId} 10 Page Audio Story`;
  114 |     const longAudioTitle = `QA ${runId} 20 Page Audio Story`;
  115 |     const upsellTitle = `QA ${runId} Audio Upsell Story`;
  116 | 
  117 |     await page.getByText('5 pages', { exact: true }).click();
  118 |     await page.getByPlaceholder("e.g. Mimi's Great Adventure").fill(wizardTitle);
  119 |     await page.getByPlaceholder('e.g. Mimi', { exact: true }).fill('Milo');
  120 |     await page.getByRole('button', { name: 'Create Book' }).click();
  121 |     await expect(page.getByRole('heading', { name: wizardTitle })).toBeVisible();
  122 |     const wizardBookId = new URL(page.url()).searchParams.get('bookId');
  123 |     expect(wizardBookId).toBeTruthy();
  124 |     const wizardBook = (await apiJson(authenticatedApi, 'get', `/childrens-books/${wizardBookId}`)).data;
  125 |     expect(wizardBook.pageCount).toBe(5);
  126 |     expect(wizardBook.priceGel).toBe(500);
  127 |     expect(wizardBook.audioAddOnPurchased).toBe(false);
  128 |     await page.goto('/en/dashboard/tools/childrens-book');
  129 | 
  130 |     books.push(await createBookPath(authenticatedApi, 5, false, quietTitle));
  131 |     books.push(await createBookPath(authenticatedApi, 10, true, audioTitle));
  132 |     books.push(await createBookPath(authenticatedApi, 20, true, longAudioTitle));
  133 |     const upsellBookId = await createApprovedAudioUpsellBook(authenticatedApi, upsellTitle);
  134 |     expect(books.map(({ narrationCount }) => narrationCount)).toEqual([0, 10, 20]);
  135 | 
  136 |     const audioBook = books[1];
  137 |     const image = await authenticatedApi.get(`childrens-books/${audioBook.id}/page/1/image`);
  138 |     expect(image.ok()).toBeTruthy();
  139 |     expect(image.headers()['content-type']).toContain('image/png');
  140 |     const audio = await authenticatedApi.get(`childrens-books/${audioBook.id}/audio/page/1`);
  141 |     expect(audio.ok()).toBeTruthy();
  142 |     expect(audio.headers()['content-type']).toContain('audio/wav');
  143 |     const firstPageAudio = await audio.body();
```