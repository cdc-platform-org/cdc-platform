# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: blog-seo.spec.ts >> Blog navigation >> the collapsed-menu "Blog" link (<1420px) lands on /blog
- Location: e2e/blog-seo.spec.ts:39:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Toggle menu' })

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
            - button "Log In" [ref=e56] [cursor=pointer]
      - generic [ref=e59]:
        - generic [ref=e60]:
          - generic [ref=e61]:
            - paragraph [ref=e62]: CDC ACADEMY
            - heading "Build skills. Shape your career." [level=1] [ref=e64]
            - paragraph [ref=e65]: Learn practical skills, build a portfolio and prepare for your next step in a digital career.
            - generic [ref=e66]:
              - link "Explore courses" [ref=e67] [cursor=pointer]:
                - /url: "#courses"
              - link "Join the Platform" [ref=e70] [cursor=pointer]:
                - /url: /en/auth/register
          - figure "Center of Digital Careers See All Photos" [ref=e71]:
            - img "CDC — students and trainings" [ref=e73]
            - generic [ref=e83]:
              - generic [ref=e84]: Center of Digital Careers
              - link "See All Photos" [ref=e85] [cursor=pointer]:
                - /url: /en/about/gallery
        - region "Popular with our learners" [ref=e90]:
          - generic [ref=e91]:
            - heading "Popular with our learners" [level=2] [ref=e92]
            - generic [ref=e93]:
              - button "Previous courses" [ref=e94] [cursor=pointer]
              - button "Next courses" [ref=e97] [cursor=pointer]
          - article [ref=e102]:
            - generic [ref=e103]:
              - link "QA E2E Test Course" [ref=e104] [cursor=pointer]:
                - /url: /en/courses/00000000-0000-4000-8000-0000000c0575
                - generic [ref=e108]:
                  - generic [ref=e109]: QA Fixtures
                  - generic [ref=e110]: 🇬🇪 Georgian
                - generic [ref=e111]: New
              - button "Save QA E2E Test Course" [ref=e112] [cursor=pointer]
            - generic [ref=e115]:
              - link [ref=e116] [cursor=pointer]:
                - /url: /en/courses/00000000-0000-4000-8000-0000000c0575
                - heading "QA E2E Test Course" [level=3] [ref=e117]
              - paragraph [ref=e119]: CDC Academy
              - generic [ref=e120]: 1 students
              - generic [ref=e127]:
                - generic [ref=e128]: 100.00 ₾
                - link "View Details" [ref=e130] [cursor=pointer]:
                  - /url: /en/courses/00000000-0000-4000-8000-0000000c0575
      - generic [ref=e131]:
        - heading "Ecosystem Achievements" [level=2] [ref=e134]
        - generic [ref=e135]:
          - generic [ref=e136]:
            - img "HEKS/EPER Georgia" [ref=e137]
            - generic [ref=e138]:
              - generic [ref=e139]: HEKS/EPER · EU
              - heading "HEKS/EPER Georgia Support" [level=3] [ref=e140]
              - paragraph [ref=e141]: International standard educational methodology and resources specially designed for regional technological progress.
              - link "About the Project" [ref=e142] [cursor=pointer]:
                - /url: https://socialinnovation.ge/%e1%83%aa%e1%83%98%e1%83%a4%e1%83%a0%e1%83%a3%e1%83%9a%e1%83%98-%e1%83%9e%e1%83%a0%e1%83%9d%e1%83%a4%e1%83%94%e1%83%a1%e1%83%98%e1%83%91%e1%83%98%e1%83%a1-%e1%83%aa%e1%83%94%e1%83%9c%e1%83%a2/
          - generic [ref=e146]:
            - generic [ref=e147]:
              - generic [ref=e148]: 200+
              - generic [ref=e149]: "01"
            - generic [ref=e150]: Graduates
          - generic [ref=e156]:
            - generic [ref=e157]:
              - generic [ref=e158]: 100%
              - generic [ref=e159]: "02"
            - generic [ref=e160]: Practical Tasks
      - generic [ref=e167]:
        - generic [ref=e172]:
          - heading "Not sure which digital profession to choose? Take the test" [level=2] [ref=e173]
          - paragraph [ref=e174]: Get a personalized career recommendation from our digital assistant in 1 minute.
        - link "Start the Test" [ref=e175] [cursor=pointer]:
          - /url: /en/career-test
      - generic [ref=e178]:
        - generic [ref=e179]:
          - heading "Authorized Programs" [level=2] [ref=e181]
          - link "All courses" [ref=e182] [cursor=pointer]:
            - /url: /en/courses
        - generic [ref=e185]:
          - link "🎁 5-Day Free Trial 🤖 AI Interactive Course IMIAKO — Your Personal AI English Tutor Learn English from 9 native languages (Georgian, German, Spanish, Ukrainian & more) Personal goals (Travel, IT, Business, Daily, Interview) 6 exercise types + voice dialogues (Azure Audio) 29 GEL / month (5 days free, no card required) Start Learning For Free" [ref=e186] [cursor=pointer]:
            - /url: /en/dashboard/english-tutor
            - generic [ref=e187]: 🎁 5-Day Free Trial
            - generic [ref=e188]:
              - generic [ref=e189]: 🤖 AI Interactive Course
              - heading "IMIAKO — Your Personal AI English Tutor" [level=3] [ref=e193]
              - list [ref=e197]:
                - listitem [ref=e198]: Learn English from 9 native languages (Georgian, German, Spanish, Ukrainian & more)
                - listitem [ref=e201]: Personal goals (Travel, IT, Business, Daily, Interview)
                - listitem [ref=e204]: 6 exercise types + voice dialogues (Azure Audio)
            - generic [ref=e207]:
              - paragraph [ref=e208]: 29 GEL / month (5 days free, no card required)
              - generic [ref=e209]: Start Learning For Free
          - article [ref=e210]:
            - generic [ref=e211]:
              - link "QA E2E Test Course" [ref=e212] [cursor=pointer]:
                - /url: /en/courses/00000000-0000-4000-8000-0000000c0575
                - generic [ref=e216]:
                  - generic [ref=e217]: QA Fixtures
                  - generic [ref=e218]: 🇬🇪 Georgian
                - generic [ref=e219]: New
              - button "Save QA E2E Test Course" [ref=e220] [cursor=pointer]
            - generic [ref=e223]:
              - link [ref=e224] [cursor=pointer]:
                - /url: /en/courses/00000000-0000-4000-8000-0000000c0575
                - heading "QA E2E Test Course" [level=3] [ref=e225]
              - paragraph [ref=e227]: CDC Academy
              - generic [ref=e228]: 1 students
              - generic [ref=e235]:
                - generic [ref=e236]: 100.00 ₾
                - button "Buy · 100.00 ₾" [ref=e238] [cursor=pointer]
      - generic [ref=e243]:
        - generic [ref=e244]:
          - generic [ref=e245]:
            - heading "Live Trainings & Workshops" [level=2] [ref=e246]
            - paragraph [ref=e247]: Scheduled live sessions — register your spot, we'll call you to confirm.
          - link "View all live trainings" [ref=e248] [cursor=pointer]:
            - /url: /en/live-trainings
        - generic [ref=e251]:
          - link "QA Fixtures 1/15/2030, 2:00:00 PM QA E2E Live Training 0 reviews Seeded training for rating and media tests. Payment endpoints are intercepted by Playwright. 99 seats left of 100 100.00 ₾" [ref=e252] [cursor=pointer]:
            - /url: /en/live-trainings/00000000-0000-4000-8000-000000007a10
            - generic [ref=e257]:
              - generic [ref=e258]: QA Fixtures
              - generic [ref=e259]: 1/15/2030, 2:00:00 PM
            - heading "QA E2E Live Training" [level=3] [ref=e263]
            - generic [ref=e264]: 0 reviews
            - paragraph [ref=e266]: Seeded training for rating and media tests. Payment endpoints are intercepted by Playwright.
            - generic [ref=e267]:
              - generic [ref=e268]: 99 seats left of 100
              - generic [ref=e274]: 100.00 ₾
          - link "QA Fixtures 2/15/2030, 2:00:00 PM QA E2E Free Live Training 0 reviews Seeded FREE training for the invite/QR redemption e2e test. 99 seats left of 100 Free" [ref=e275] [cursor=pointer]:
            - /url: /en/live-trainings/00000000-0000-4000-8000-000000007a11
            - generic [ref=e280]:
              - generic [ref=e281]: QA Fixtures
              - generic [ref=e282]: 2/15/2030, 2:00:00 PM
            - heading "QA E2E Free Live Training" [level=3] [ref=e286]
            - generic [ref=e287]: 0 reviews
            - paragraph [ref=e289]: Seeded FREE training for the invite/QR redemption e2e test.
            - generic [ref=e290]:
              - generic [ref=e291]: 99 seats left of 100
              - generic [ref=e297]: Free
      - generic [ref=e299]:
        - generic [ref=e300]:
          - generic [ref=e301]: CDC AI
          - heading "Digital Tools" [level=2] [ref=e305]
          - paragraph [ref=e306]: AI-powered products built by CDC for businesses and employers.
        - generic [ref=e307]:
          - generic [ref=e313]:
            - generic [ref=e314]:
              - heading "Enterprise AI Assistant & Knowledge Base" [level=3] [ref=e315]
              - generic [ref=e316]: Available now
            - paragraph [ref=e317]: Build your own AI chatbot for your company — it learns your business and answers visitors directly from your website.
            - list [ref=e318]:
              - listitem [ref=e319]: A custom AI chatbot for your website
              - listitem [ref=e322]: Your own Q&A-style knowledge base
              - listitem [ref=e325]: An embeddable widget — one snippet and it is live
              - listitem [ref=e330]: Visitor conversation analytics
            - button "7 Days Free" [ref=e333] [cursor=pointer]
          - generic [ref=e342]:
            - generic [ref=e343]:
              - heading "IMIAKO — Your 24/7 AI English Tutor" [level=3] [ref=e344]
              - generic [ref=e345]: Available now
            - list [ref=e346]:
              - listitem [ref=e347]: 🎁 5-day free trial (no card required)
              - listitem [ref=e352]: 🌍 Learn English from 9 native languages
              - listitem [ref=e356]: 🎯 Personal goals (Travel, IT, Business, etc.)
            - link "Start Learning For Free" [ref=e361] [cursor=pointer]:
              - /url: /en/dashboard/english-tutor
          - generic [ref=e365]:
            - generic [ref=e366]: Coming Soon
            - heading "AI Proctored Exam & Skill Assessment System" [level=3] [ref=e375]
            - paragraph [ref=e376]: AI-powered online exams with real-time proctoring and automated candidate skill assessment.
          - generic [ref=e377]:
            - generic [ref=e378]: Coming Soon
            - heading "AI Candidate Screener & HR Assistant" [level=3] [ref=e389]
            - paragraph [ref=e390]: An AI assistant that helps employers pre-screen candidates and automate HR workflows.
          - link "View All Tools →" [ref=e392] [cursor=pointer]:
            - /url: /en/tools
      - generic [ref=e393]:
        - generic [ref=e394]:
          - heading "News & Blog Articles" [level=2] [ref=e396]
          - link "All Articles" [ref=e397] [cursor=pointer]:
            - /url: /en/blog
        - generic [ref=e400]:
          - link "QA QA E2E Article — No Cover A seeded article with no cover — must fall back to the default social image." [ref=e401] [cursor=pointer]:
            - /url: /en/blog/qa-e2e-post-no-cover
            - generic [ref=e407]: QA
            - heading "QA E2E Article — No Cover" [level=3] [ref=e408]
            - paragraph [ref=e409]: A seeded article with no cover — must fall back to the default social image.
          - link "QA E2E Article — Other Cover QA QA E2E Article — Other Cover A second seeded article with a different cover image." [ref=e410] [cursor=pointer]:
            - /url: /en/blog/qa-e2e-post-with-other-cover
            - img "QA E2E Article — Other Cover" [ref=e412]
            - generic [ref=e413]: QA
            - heading "QA E2E Article — Other Cover" [level=3] [ref=e414]
            - paragraph [ref=e415]: A second seeded article with a different cover image.
          - link "QA E2E Article — With Cover QA QA E2E Article — With Cover A seeded article description for the Playwright suite." [ref=e416] [cursor=pointer]:
            - /url: /en/blog/qa-e2e-post-with-cover
            - img "QA E2E Article — With Cover" [ref=e418]
            - generic [ref=e419]: QA
            - heading "QA E2E Article — With Cover" [level=3] [ref=e420]
            - paragraph [ref=e421]: A seeded article description for the Playwright suite.
      - generic [ref=e423]:
        - heading "AI English Learning Tools" [level=2] [ref=e426]
        - generic [ref=e428]:
          - generic [ref=e429]:
            - generic [ref=e430]:
              - heading "AI Smart Reader & Language Teacher" [level=2] [ref=e431]
              - paragraph [ref=e432]: Interactive Reader, Karaoke Highlight & Pronunciation Coach
            - generic [ref=e433]:
              - combobox [ref=e434]:
                - option "🇬🇧 English" [selected]
                - option "🇩🇪 German"
                - option "🇪🇸 Español"
                - option "🇫🇷 Français"
              - generic [ref=e435]: ➔
              - combobox [ref=e436]:
                - option "🇬🇪 ქართული" [selected]
                - option "🇬🇧 English"
                - option "🇺🇦 Українська"
                - option "🇹🇷 Türkçe"
                - option "🇦🇲 Հայերեն"
                - option "🇦🇿 Azərbaycan"
          - generic [ref=e437]:
            - button "Summarize & CEFR Analysis" [ref=e438] [cursor=pointer]
            - generic [ref=e439]:
              - button "Play" [ref=e440] [cursor=pointer]
              - generic [ref=e441]:
                - text: "Speed:"
                - slider "Speed:" [ref=e442]: "1"
            - textbox "Paste or type any text here..." [ref=e443]: Learning a new language opens up doors to different cultures and ways of thinking.
      - contentinfo [ref=e444]:
        - generic [ref=e445]:
          - generic [ref=e446]:
            - link "CDC" [ref=e447] [cursor=pointer]:
              - /url: /en
              - img "CDC" [ref=e448]
            - paragraph [ref=e450]: Teaching digital professions in Guria — supported by HEKS/EPER Georgia.
            - list [ref=e451]:
              - listitem [ref=e452]:
                - link "contact@cdc.org.ge" [ref=e453] [cursor=pointer]:
                  - /url: mailto:contact@cdc.org.ge
              - listitem [ref=e457]:
                - link "+995 551 14 14 11" [ref=e458] [cursor=pointer]:
                  - /url: tel:+995551141411
          - generic [ref=e461]:
            - heading "Digital College" [level=3] [ref=e462]
            - list [ref=e463]:
              - listitem [ref=e464]:
                - link "All Courses" [ref=e465] [cursor=pointer]:
                  - /url: /en/courses
              - listitem [ref=e466]:
                - link "🎁 Gift cards" [ref=e467] [cursor=pointer]:
                  - /url: /en/gift-cards
              - listitem [ref=e468]:
                - link "Success Stories" [ref=e469] [cursor=pointer]:
                  - /url: /en/success-stories
              - listitem [ref=e470]:
                - link "Trainers" [ref=e471] [cursor=pointer]:
                  - /url: /en/trainers
              - listitem [ref=e472]:
                - link "Photo Gallery" [ref=e473] [cursor=pointer]:
                  - /url: /en/gallery
          - generic [ref=e474]:
            - heading "Community" [level=3] [ref=e475]
            - list [ref=e476]:
              - listitem [ref=e477]:
                - link "Jobs & Projects" [ref=e478] [cursor=pointer]:
                  - /url: /en/community
              - listitem [ref=e479]:
                - link "Mentors" [ref=e480] [cursor=pointer]:
                  - /url: /en/mentors
              - listitem [ref=e481]:
                - link "Digital Market" [ref=e482] [cursor=pointer]:
                  - /url: /en/marketplace
              - listitem [ref=e483]:
                - link "AI Tools" [ref=e484] [cursor=pointer]:
                  - /url: /en/marketplace?category=Digital%20AI%20Tools
              - listitem [ref=e485]:
                - link "Forum" [ref=e486] [cursor=pointer]:
                  - /url: /en/forum
              - listitem [ref=e487]:
                - link "CDC Studio" [ref=e488] [cursor=pointer]:
                  - /url: /en/agency
              - listitem [ref=e489]:
                - link "Case Studies" [ref=e490] [cursor=pointer]:
                  - /url: /en/cases
          - generic [ref=e491]:
            - heading "Help" [level=3] [ref=e492]
            - list [ref=e493]:
              - listitem [ref=e494]:
                - link "Video Tutorials" [ref=e495] [cursor=pointer]:
                  - /url: /en/tutorials
              - listitem [ref=e496]:
                - link "About Us" [ref=e497] [cursor=pointer]:
                  - /url: /en/about
              - listitem [ref=e498]:
                - link "Get in Touch" [ref=e499] [cursor=pointer]:
                  - /url: /en/contact
          - generic [ref=e500]:
            - heading "Legal" [level=3] [ref=e501]
            - list [ref=e502]:
              - listitem [ref=e503]:
                - link "Privacy Policy" [ref=e504] [cursor=pointer]:
                  - /url: /en/privacy
              - listitem [ref=e505]:
                - link "Terms & Conditions" [ref=e506] [cursor=pointer]:
                  - /url: /en/terms
              - listitem [ref=e507]:
                - link "Refund Policy" [ref=e508] [cursor=pointer]:
                  - /url: /en/refund-policy
            - heading "Follow Us" [level=3] [ref=e509]
            - generic [ref=e510]:
              - link "Facebook" [ref=e511] [cursor=pointer]:
                - /url: https://www.facebook.com/cdc.digitalcareers
              - link "Instagram" [ref=e514] [cursor=pointer]:
                - /url: https://www.instagram.com/digitalcareers1/
              - link "TikTok" [ref=e519] [cursor=pointer]:
                - /url: https://www.tiktok.com/@digitalcareers.geo
              - link "LinkedIn" [ref=e522] [cursor=pointer]:
                - /url: https://www.linkedin.com/in/cdc-%E1%83%AA%E1%83%98%E1%83%A4%E1%83%A0%E1%83%A3%E1%83%9A%E1%83%98-%E1%83%9E%E1%83%A0%E1%83%9D%E1%83%A4%E1%83%94%E1%83%A1%E1%83%98%E1%83%91%E1%83%98%E1%83%A1-%E1%83%AA%E1%83%94%E1%83%9C%E1%83%A2%E1%83%A0%E1%83%98-473404428/
        - generic [ref=e526]:
          - generic [ref=e527]:
            - generic [ref=e528]: We Accept
            - generic [ref=e529]: VISA
            - generic [ref=e530]: Mastercard
            - generic [ref=e531]: BOG Pay
          - generic [ref=e532]:
            - paragraph [ref=e533]: ა(ა)იპ ციფრული პროფესიების ცენტრი / Digital Careers Center (CDC Georgia)
            - paragraph [ref=e534]: "ს/კ / ID Code: 438737743"
        - paragraph [ref=e536]: © 2026 Digital Careers Center (CDC Georgia). All rights reserved.
    - button "Scroll to top"
    - generic [ref=e537]:
      - button "Chat with assistant" [ref=e538] [cursor=pointer]
      - link "Message us on WhatsApp" [ref=e542] [cursor=pointer]:
        - /url: https://wa.me/message/AN67535SBUEWN1
    - generic [ref=e547]:
      - paragraph [ref=e552]:
        - text: We use cookies to keep the site running smoothly and improve your experience.
        - link "Learn more" [ref=e553] [cursor=pointer]:
          - /url: /en/privacy
      - generic [ref=e554]:
        - button "Manage" [ref=e555] [cursor=pointer]
        - button "Accept All" [ref=e556] [cursor=pointer]
  - alert [ref=e557]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Fixed slugs from Backend/prisma/seedE2E.ts — see that file's own comment
  4   | // on why these three specific cases (real cover, a DIFFERENT real cover, no
  5   | // cover at all) are what's seeded.
  6   | const WITH_COVER_SLUG = 'qa-e2e-post-with-cover';
  7   | const WITH_OTHER_COVER_SLUG = 'qa-e2e-post-with-other-cover';
  8   | const NO_COVER_SLUG = 'qa-e2e-post-no-cover';
  9   | 
  10  | // Pulls a <meta ...> tag's content out of raw HTML by its property/name
  11  | // attribute — deliberately not a DOM query (see the describe block's own
  12  | // comment on why these tests fetch raw HTML instead of a rendered page).
  13  | function metaContent(html: string, attr: 'property' | 'name', key: string): string | null {
  14  |   const tag = html.match(new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, 'i'))?.[0];
  15  |   return tag?.match(/content=["']([^"']*)["']/)?.[1] ?? null;
  16  | }
  17  | 
  18  | test.describe('Blog navigation', () => {
  19  |   test('main nav "Blog" links go directly to /blog, never a homepage anchor', async ({ page }) => {
  20  |     // Raw HTML, not a click-through: proves the actual href in the
  21  |     // server-rendered markup, independent of how a browser resolves it.
  22  |     const html = await (await page.request.get('/')).text();
  23  |     expect(html).not.toMatch(/href="\/?#blog"/);
  24  |     // The wide-viewport nav link and the blog-preview section's own "All
  25  |     // Articles" link are both always in the initial HTML — see
  26  |     // pages/index.tsx. The collapsed-menu (<1420px) duplicate is only
  27  |     // mounted once opened (isMobileMenuOpen), so it's intentionally not
  28  |     // part of this count; the dedicated tests below open it directly.
  29  |     expect((html.match(/href="\/blog"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  30  |   });
  31  | 
  32  |   test('the wide-viewport nav "Blog" link (>=1420px) lands on /blog', async ({ page }) => {
  33  |     await page.setViewportSize({ width: 1440, height: 900 });
  34  |     await page.goto('/en');
  35  |     await page.getByRole('link', { name: /^Blog$/i }).first().click();
  36  |     await expect(page).toHaveURL(/\/blog$/);
  37  |   });
  38  | 
  39  |   test('the collapsed-menu "Blog" link (<1420px) lands on /blog', async ({ page }) => {
  40  |     await page.setViewportSize({ width: 1280, height: 900 });
  41  |     await page.goto('/en');
> 42  |     await page.getByRole('button', { name: 'Toggle menu' }).click();
      |                                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
  43  |     await page.getByRole('link', { name: /^Blog$/i }).click();
  44  |     await expect(page).toHaveURL(/\/blog$/);
  45  |   });
  46  | });
  47  | 
  48  | // These fetch raw HTML via page.request (no browser JS execution at all) —
  49  | // the same thing a Facebook/LinkedIn/Twitter crawler sees. A test that only
  50  | // checked the rendered DOM after hydration could pass even if the
  51  | // server-rendered HTML itself were missing every og:/twitter: tag, which is
  52  | // exactly the bug this suite exists to catch (see pages/blog/[slug].tsx's
  53  | // getServerSideProps).
  54  | test.describe('Blog article social-share metadata (server-rendered)', () => {
  55  |   test('each article gets its own real, absolute, distinct og:image; no cover falls back to the platform default', async ({ page }) => {
  56  |     const [htmlA, htmlB, htmlC] = await Promise.all(
  57  |       [WITH_COVER_SLUG, WITH_OTHER_COVER_SLUG, NO_COVER_SLUG].map((slug) => page.request.get(`/blog/${slug}`).then((r) => r.text()))
  58  |     );
  59  | 
  60  |     const imageA = metaContent(htmlA, 'property', 'og:image');
  61  |     const imageB = metaContent(htmlB, 'property', 'og:image');
  62  |     const imageC = metaContent(htmlC, 'property', 'og:image');
  63  | 
  64  |     expect(imageA).toMatch(/^https?:\/\//);
  65  |     expect(imageA).toContain('heks-eper.jpg');
  66  |     expect(imageB).toMatch(/^https?:\/\//);
  67  |     expect(imageB).toContain('cdc-logo.png');
  68  |     expect(imageA).not.toBe(imageB); // two different articles must never share one og:image.
  69  | 
  70  |     // No cover at all -> the real branded default banner (og-default.jpg),
  71  |     // never the old stretched-logo fallback, and never mistaken for either
  72  |     // real article cover above.
  73  |     expect(imageC).toMatch(/^https?:\/\//);
  74  |     expect(imageC).toContain('og-default.jpg');
  75  |     expect(imageC).not.toBe(imageA);
  76  |     expect(imageC).not.toBe(imageB);
  77  |     // The default banner's real, known pixel size — never guessed for a
  78  |     // per-article cover (see SEOHead.tsx's own comment on why).
  79  |     expect(metaContent(htmlC, 'property', 'og:image:width')).toBe('1200');
  80  |     expect(metaContent(htmlC, 'property', 'og:image:height')).toBe('630');
  81  |     expect(metaContent(htmlA, 'property', 'og:image:width')).toBeNull();
  82  | 
  83  |     for (const html of [htmlA, htmlB, htmlC]) {
  84  |       expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
  85  |       expect(metaContent(html, 'property', 'og:type')).toBe('article');
  86  |       const ogUrl = metaContent(html, 'property', 'og:url');
  87  |       expect(ogUrl).toMatch(/^https:\/\//); // absolute production-style origin, not a relative path.
  88  |       const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  89  |       expect(canonical).toBe(ogUrl);
  90  |     }
  91  |   });
  92  | 
  93  |   test('Georgian title/description render correctly in the default-locale metadata', async ({ page }) => {
  94  |     const html = await (await page.request.get(`/blog/${WITH_COVER_SLUG}`)).text();
  95  |     expect(metaContent(html, 'property', 'og:title')).toContain('ყდით');
  96  |     expect(metaContent(html, 'name', 'description')).toContain('სატესტო');
  97  |   });
  98  | 
  99  |   test('the English locale renders the English title/description instead', async ({ page }) => {
  100 |     const html = await (await page.request.get(`/en/blog/${WITH_COVER_SLUG}`)).text();
  101 |     expect(metaContent(html, 'property', 'og:title')).toContain('With Cover');
  102 |     expect(metaContent(html, 'name', 'description')).toContain('seeded article description');
  103 |   });
  104 | 
  105 |   test('social share buttons target the article\'s own URL, not the homepage', async ({ page }) => {
  106 |     await page.goto(`/en/blog/${WITH_COVER_SLUG}`);
  107 |     const facebookShare = page.locator(`a[href*="facebook.com/sharer"]`);
  108 |     await expect(facebookShare).toHaveAttribute('href', new RegExp(`blog%2F${WITH_COVER_SLUG}`));
  109 |   });
  110 | });
  111 | 
```