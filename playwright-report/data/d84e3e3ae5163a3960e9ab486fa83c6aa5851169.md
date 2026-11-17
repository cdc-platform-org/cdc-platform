# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: live-training-checkout.spec.ts >> Authenticated live training checkout >> promo removal restores price and free checkout requires server-confirmed enrollment
- Location: e2e/live-training-checkout.spec.ts:109:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
-   "currency": "usd",
+   "lang": "en",
    "promoCode": "QA100",
  }
```

```
Error: page.waitForResponse: Test ended.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - status [ref=e4]:
      - generic [ref=e5]:
        - paragraph [ref=e6]:
          - text: "The platform is in beta. Support:"
          - link "contact@cdc.org.ge" [ref=e7] [cursor=pointer]:
            - /url: mailto:contact@cdc.org.ge
        - button "Dismiss" [ref=e8] [cursor=pointer]
    - generic [ref=e12]:
      - navigation [ref=e13]:
        - generic [ref=e14]:
          - link "CDC" [ref=e16] [cursor=pointer]:
            - /url: /en
            - img "CDC" [ref=e17]
          - generic [ref=e19]:
            - button "Digital College" [ref=e21] [cursor=pointer]
            - button "Digital Market" [ref=e25] [cursor=pointer]
            - button "Employment" [ref=e29] [cursor=pointer]
            - link "Forum" [ref=e32] [cursor=pointer]:
              - /url: /en/forum
            - button "About" [ref=e34] [cursor=pointer]
          - generic [ref=e38]:
            - searchbox "Search courses, articles, products..." [ref=e41]
            - button "Change language" [ref=e44] [cursor=pointer]:
              - generic [ref=e52]: en
            - button "Toggle dark mode" [ref=e53] [cursor=pointer]
            - button "Notifications" [ref=e57] [cursor=pointer]:
              - generic [ref=e61]: "1"
            - button "Q" [ref=e63] [cursor=pointer]
      - generic [ref=e66]:
        - button "Back" [ref=e68] [cursor=pointer]
        - generic [ref=e71]:
          - generic [ref=e72]: QA Fixtures
          - generic [ref=e73]: 🇬🇪🇬🇧 Georgian / English
        - heading "QA E2E Live Training" [level=1] [ref=e74]
        - generic [ref=e75]:
          - generic [ref=e76]:
            - generic [ref=e77]: Share
            - link "Facebook" [ref=e78] [cursor=pointer]:
              - /url: https://www.facebook.com/sharer/sharer.php?u=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
            - link "LinkedIn" [ref=e81] [cursor=pointer]:
              - /url: https://www.linkedin.com/sharing/share-offsite/?url=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
            - link "X (Twitter)" [ref=e84] [cursor=pointer]:
              - /url: https://twitter.com/intent/tweet?url=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10&text=QA%20E2E%20Live%20Training
            - link "Telegram" [ref=e87] [cursor=pointer]:
              - /url: https://t.me/share/url?url=http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10&text=QA%20E2E%20Live%20Training
            - link "WhatsApp" [ref=e90] [cursor=pointer]:
              - /url: https://api.whatsapp.com/send?text=QA%20E2E%20Live%20Training%20http%3A%2F%2Flocalhost%3A3000%2Fen%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
            - button "Copy Link" [ref=e93] [cursor=pointer]
          - link "Gift this" [ref=e97] [cursor=pointer]:
            - /url: /en/gift-cards?amount=100&item=QA+E2E+Live+Training&url=%2Flive-trainings%2F00000000-0000-4000-8000-000000007a10
        - iframe [ref=e104]:
          
        - paragraph [ref=e105]: Training checkout and video fixture.
        - generic [ref=e106]:
          - generic [ref=e107]: 1/15/2030, 2:00:00 PM
          - generic [ref=e110]: 100.00 ₾
        - generic [ref=e111]:
          - heading "Meet the trainer" [level=2] [ref=e112]
          - iframe [ref=e114]:
            
        - generic [ref=e115]:
          - generic [ref=e116]:
            - generic [ref=e117]: 99 seats left of 100
            - generic [ref=e123]: 1 / 100 registered
          - generic [ref=e126]: Minimum group reached — this session is confirmed to run
        - generic [ref=e130]:
          - generic [ref=e132]:
            - status [ref=e133]: "✓ Promo applied: QA100"
            - button "Remove promo code" [disabled] [ref=e134]
          - paragraph [ref=e136]:
            - generic [ref=e142]: Foreign Visa / Mastercard cards are accepted. You are charged in Georgian lari (GEL) and your bank converts it to your currency automatically.
          - button "Redirecting to secure payment…" [disabled] [ref=e143]
          - paragraph [ref=e144]: 🛡️ 100% refund guarantee if the group doesn't fill or the training is cancelled
          - generic [ref=e145]: or
        - generic [ref=e148]:
          - generic [ref=e149]:
            - heading "Interested? Request a callback" [level=2] [ref=e150]
            - paragraph [ref=e151]: Leave your details and we will help you with registration. No payment is required.
          - generic [ref=e152]:
            - generic [ref=e153]: First name
            - textbox "First name" [ref=e154]
          - generic [ref=e155]:
            - generic [ref=e156]: Last name
            - textbox "Last name" [ref=e157]
          - generic [ref=e158]:
            - generic [ref=e159]: Phone number
            - textbox "Phone number" [ref=e160]:
              - /placeholder: +995 5XX XX XX XX
          - button "Register" [ref=e161] [cursor=pointer]
        - region [ref=e163]:
          - heading "Ratings and reviews" [level=2] [ref=e164]
          - generic [ref=e165]: 0 reviews
          - paragraph [ref=e168]: Only enrolled participants can submit a review.
          - paragraph [ref=e169]: No reviews yet.
    - button "Scroll to top" [ref=e170] [cursor=pointer]
    - generic [ref=e174]:
      - paragraph [ref=e179]:
        - text: We use cookies to keep the site running smoothly and improve your experience.
        - link "Learn more" [ref=e180] [cursor=pointer]:
          - /url: /en/privacy
      - generic [ref=e181]:
        - button "Manage" [ref=e182] [cursor=pointer]
        - button "Accept All" [ref=e183] [cursor=pointer]
  - alert [ref=e184]
```

# Test source

```ts
  35  | test.describe('Public live training registration', () => {
  36  |   test('callback form collects contact details without granting enrollment', async ({ page }) => {
  37  |     await mockTraining(page);
  38  |     let payload: Record<string, unknown> | undefined;
  39  |     await page.route(`**/api${TRAINING_PATH}/register`, async (route) => {
  40  |       payload = route.request().postDataJSON();
  41  |       await route.fulfill({ status: 201, json: { data: { id: 'test-lead' } } });
  42  |     });
  43  |     await page.goto(`/en${TRAINING_PATH}`);
  44  |     await page.getByLabel('First name', { exact: true }).fill('  Ada  ');
  45  |     await page.getByLabel('Last name', { exact: true }).fill('  Lovelace  ');
  46  |     await page.getByLabel('Phone number', { exact: true }).fill('+995 555 12 34 56');
  47  |     await page.getByRole('button', { name: 'Register', exact: true }).click();
  48  |     await expect(page.getByText(/No payment has been taken/)).toBeVisible();
  49  |     expect(payload).toEqual({ firstName: 'Ada', lastName: 'Lovelace', phone: '+995 555 12 34 56', website: '', locale: 'en' });
  50  |     await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toHaveCount(0);
  51  |     await expect(page.getByRole('button', { name: /Register & Pay/ })).toBeVisible();
  52  |   });
  53  | 
  54  |   test('paid registration opens authentication and public videos use safe embeds', async ({ page }) => {
  55  |     await mockTraining(page);
  56  |     let checkoutCalls = 0;
  57  |     page.on('request', (request) => { if (paidCheckout.test(request.url())) checkoutCalls++; });
  58  |     await page.goto(`/en${TRAINING_PATH}`);
  59  |     await expect(page.locator('iframe[title="QA E2E Live Training"]')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  60  |     await expect(page.locator('iframe[title="Meet the trainer — QA E2E Live Training"]')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=abc123def0');
  61  |     await page.getByRole('button', { name: /Register & Pay/ }).click();
  62  |     await expect(page.getByText('Sign in or create an account to register for this training.')).toBeVisible();
  63  |     expect(checkoutCalls).toBe(0);
  64  |     await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toHaveCount(0);
  65  |   });
  66  | });
  67  | 
  68  | test.describe('Live training promo code field', () => {
  69  |   test('guests see the promo field, and applying asks them to sign in first', async ({ page }) => {
  70  |     await mockTraining(page, { saleActive: true, isOnSale: true, currentPrice: 8000, discountedPrice: 8000 });
  71  |     let validateCalls = 0;
  72  |     page.on('request', (request) => { if (request.url().includes('/api/promos/validate')) validateCalls++; });
  73  |     await page.goto(`/en${TRAINING_PATH}`);
  74  |     await page.getByRole('textbox', { name: 'Promo code', exact: true }).fill('qa10');
  75  |     await page.getByRole('button', { name: 'Apply', exact: true }).click();
  76  |     await expect(page.getByText('Sign in or create an account to register for this training.')).toBeVisible();
  77  |     expect(validateCalls).toBe(0);
  78  |   });
  79  | });
  80  | 
  81  | test.describe('Authenticated live training checkout', () => {
  82  |   test.use({ storageState: AUTH_STATE_PATH });
  83  | 
  84  |   for (const locale of ['ka', 'en']) {
  85  |     test(`${locale} uses the expected gateway and never reports enrollment on failure`, async ({ page }) => {
  86  |       await mockTraining(page);
  87  |       let checkoutPath = '';
  88  |       let checkoutPayload: Record<string, unknown> | undefined;
  89  |       await page.route(paidCheckout, async (route) => {
  90  |         checkoutPath = new URL(route.request().url()).pathname;
  91  |         checkoutPayload = route.request().postDataJSON();
  92  |         await route.fulfill({ status: 503, json: { message: 'Test gateway unavailable. Please retry.' } });
  93  |       });
  94  |       await page.goto(`${locale === 'en' ? '/en' : ''}${TRAINING_PATH}`);
  95  |       // The promo field is shown to guests too, so wait for auth hydration
  96  |       // explicitly before clicking (a guest click would open the sign-in modal).
  97  |       await expect(page.getByTestId('live-training-promo')).toHaveAttribute('data-signed-in', 'true');
  98  |       await expect(page.getByRole('textbox', { name: /Promo code|პრომო კოდი/ })).toBeVisible();
  99  |       const checkoutButton = page.getByRole('button', { name: /Register & Pay|რეგისტრაცია და გადახდა/ });
  100 |       await checkoutButton.click();
  101 |       await expect(page.getByRole('alert').filter({ hasText: 'Test gateway unavailable. Please retry.' })).toBeVisible();
  102 |       expect(checkoutPath).toBe(`/api/payments/${locale === 'en' ? 'stripe/' : ''}checkout/live-training/${TRAINING_ID}`);
  103 |       expect(checkoutPayload).toEqual(locale === 'en' ? { currency: 'usd' } : { lang: 'ka' });
  104 |       await expect(checkoutButton).toBeEnabled();
  105 |       await expect(page.getByRole('link', { name: /Go to My Live Trainings|ჩემი ლაივ ტრენინგები/, exact: true })).toHaveCount(0);
  106 |     });
  107 |   }
  108 | 
  109 |   test('promo removal restores price and free checkout requires server-confirmed enrollment', async ({ page }) => {
  110 |     const training = await mockTraining(page);
  111 |     await page.route('**/api/promos/validate', async (route) => {
  112 |       expect(route.request().postDataJSON()).toEqual({ code: 'QA100', targetType: 'LIVE_TRAINING', targetId: TRAINING_ID });
  113 |       await route.fulfill({ json: { data: { code: 'QA100', discountPercent: 100, discountAmount: null, originalAmount: 10000, discountedAmount: 0 } } });
  114 |     });
  115 |     let confirmEnrollment = false;
  116 |     await page.route(paidCheckout, async (route) => {
  117 |       expect(route.request().postDataJSON()).toEqual({ promoCode: 'QA100', currency: 'usd' });
  118 |       if (confirmEnrollment) {
  119 |         training.isEnrolled = true;
  120 |         await page.route(`**/api${TRAINING_PATH}/ratings`, (ratingRoute) => ratingRoute.fulfill({ json: { data: { ...emptyRatings, canReview: true } } }));
  121 |       }
  122 |       await route.fulfill({ json: { paymentId: 'test-free-checkout', redirectUrl: null, enrolled: true } });
  123 |     });
  124 |     await page.goto(`/en${TRAINING_PATH}`);
  125 |     await expect(page.getByTestId('live-training-promo')).toHaveAttribute('data-signed-in', 'true');
  126 |     const applyPromo = async () => {
  127 |       await page.getByRole('textbox', { name: 'Promo code', exact: true }).fill('qa100');
  128 |       await page.getByRole('button', { name: 'Apply', exact: true }).click();
  129 |       await expect(page.getByRole('button', { name: 'Register & Pay (0.00 ₾)', exact: true })).toBeVisible();
  130 |     };
  131 |     await applyPromo();
  132 |     await page.getByRole('button', { name: 'Remove promo code' }).click();
  133 |     await expect(page.getByRole('button', { name: 'Register & Pay (100.00 ₾)', exact: true })).toBeVisible();
  134 |     await applyPromo();
> 135 |     const refreshed = page.waitForResponse((response) => response.url().endsWith(`/api${TRAINING_PATH}`));
      |                            ^ Error: page.waitForResponse: Test ended.
  136 |     await page.getByRole('button', { name: 'Register & Pay (0.00 ₾)', exact: true }).click();
  137 |     await refreshed;
  138 |     await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toHaveCount(0);
  139 |     confirmEnrollment = true;
  140 |     await page.getByRole('button', { name: 'Register & Pay (0.00 ₾)', exact: true }).click();
  141 |     await expect(page.getByRole('link', { name: 'Go to My Live Trainings' })).toBeVisible();
  142 |     await expect(page.getByRole('button', { name: 'Save review', exact: true })).toBeVisible();
  143 |   });
  144 | 
  145 |   test('checkout redirects to the provided gateway without creating a local enrollment', async ({ page }) => {
  146 |     await mockTraining(page);
  147 |     await page.route(paidCheckout, (route) => route.fulfill({ json: { paymentId: 'test-payment', redirectUrl: 'https://checkout.invalid/e2e-only' } }));
  148 |     await page.route('https://checkout.invalid/e2e-only', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Mock secure checkout</h1>' }));
  149 |     await page.goto(`/en${TRAINING_PATH}`);
  150 |     await expect(page.getByTestId('live-training-promo')).toHaveAttribute('data-signed-in', 'true');
  151 |     await page.getByRole('button', { name: /Register & Pay/ }).click();
  152 |     await expect(page).toHaveURL('https://checkout.invalid/e2e-only');
  153 |     await expect(page.getByRole('heading', { name: 'Mock secure checkout' })).toBeVisible();
  154 |   });
  155 | 
  156 |   test('admin can preview and remove both saved video URLs', async ({ page }) => {
  157 |     await page.addInitScript(() => {
  158 |       const user = JSON.parse(localStorage.getItem('cdc_user') || '{}');
  159 |       localStorage.setItem('cdc_user', JSON.stringify({ ...user, adminRole: 'SUPER_ADMIN' }));
  160 |     });
  161 |     await page.route('**/api/auth/me', async (route) => {
  162 |       const response = await route.fetch();
  163 |       const body = await response.json();
  164 |       await route.fulfill({ json: { ...body, user: { ...body.user, adminRole: 'SUPER_ADMIN' } } });
  165 |     });
  166 |     await page.route('**/api/admin/live-trainings', (route) => route.fulfill({ json: { data: [trainingFixture] } }));
  167 |     let savedPayload: Record<string, unknown> | undefined;
  168 |     await page.route(`**/api/admin${TRAINING_PATH}`, async (route) => {
  169 |       savedPayload = route.request().postDataJSON();
  170 |       await route.fulfill({ json: { data: { ...trainingFixture, ...savedPayload } } });
  171 |     });
  172 |     await page.goto('/admin/live-trainings');
  173 |     await page.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
  174 |     await expect(page.locator('iframe[title="Training trailer preview"]')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  175 |     await expect(page.locator('iframe[title="Trainer video preview"]')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?h=abc123def0');
  176 |     await page.locator('#training-video-url').fill('');
  177 |     await page.locator('#training-trainer-video-url').fill('');
  178 |     await page.getByRole('button', { name: 'განახლება', exact: true }).click();
  179 |     await expect(page.getByRole('heading', { name: 'ახალი ტრენინგი', exact: true })).toBeVisible();
  180 |     expect(savedPayload).toMatchObject({ videoUrl: '', trainerVideoUrl: '' });
  181 |     await page.getByRole('button', { name: 'რედაქტირება', exact: true }).click();
  182 |     await expect(page.locator('#training-video-url')).toHaveValue('');
  183 |     await expect(page.locator('#training-trainer-video-url')).toHaveValue('');
  184 |   });
  185 | });
  186 | 
```