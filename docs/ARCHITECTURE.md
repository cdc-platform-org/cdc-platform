# CDC Platform — Architecture Map

A short map of where things live, so a human or an AI agent can jump straight
to the right file instead of reading the whole tree. For *what* the bigger
subsystems do (pricing, escrow, AI fallback, rights protection) see
[`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).

---

## 1. Big picture

```
Browser ──► Frontend (Next.js, Vercel + Cloudflare)
              │  axios via src/services/apiClient.ts
              ▼
            Backend API (Express, Azure App Service container)  ── /api/*
              │  Prisma
              ▼
            PostgreSQL (Azure)      + Azure Blob / Bunny CDN (files)
                                    + Gemini / Azure OpenAI (AI)
                                    + BOG / Stripe (payments)
```

| Layer    | Tech                                              | Entry point                    |
|----------|---------------------------------------------------|--------------------------------|
| Frontend | Next.js **Pages Router**, React, Tailwind, next-i18next | `Frontend/pages/_app.tsx`  |
| Backend  | Express + TypeScript, Zod validation, Jest tests   | `Backend/src/server.ts`        |
| Database | PostgreSQL via Prisma                              | `Backend/prisma/schema.prisma` |

Money is always stored as `Int` minor units (tetri / cents), never `Float`.

---

## 2. Repository layout

```
/
├─ Backend/                 Express API
│  ├─ src/
│  │  ├─ server.ts          App setup + the full route mount table (/api/...)
│  │  ├─ routes/            One file per URL area (thin HTTP layer)
│  │  ├─ services/          Business logic, payments, AI, storage, e-mail
│  │  ├─ schemas/           Zod request schemas used by routes
│  │  ├─ middleware/        auth (authenticate, requireRole, requireAdminRole…), rate limits, errors
│  │  ├─ utils/             Small pure helpers (env, slugify, exam scoring…)
│  │  ├─ lib/prisma.ts      The single shared PrismaClient
│  │  └─ config/, data/     Static config / seed-like data
│  ├─ prisma/               schema.prisma, migrations/, seed scripts
│  ├─ scripts/              One-off maintenance / pilot scripts (not part of the app)
│  └─ Dockerfile            Production image (migrations run on container start)
│
├─ Frontend/                Next.js app
│  ├─ pages/                Routes = URLs (pages/courses/[id]/learn.tsx → /courses/:id/learn)
│  │  ├─ admin/             Admin panel screens
│  │  ├─ dashboard/         Logged-in user area (dashboard.tsx is the main hub)
│  │  └─ api/               A few Next.js API routes (cron hooks, chat, tts proxy)
│  ├─ src/
│  │  ├─ components/        UI, grouped by feature (admin/, dashboard/, courses/, store/…)
│  │  ├─ services/          One API client module per backend area (courseService.ts…)
│  │  ├─ context/           React contexts (Auth, AuthModal, AdminLang, VerificationDrawer)
│  │  ├─ hooks/             Reusable hooks
│  │  ├─ types/             Shared TypeScript types
│  │  ├─ utils/             Pure helpers (pricing, locale, seo…)
│  │  └─ data/              Static content (legal texts, catalogs)
│  ├─ public/locales/<lang>/<namespace>.json   Translations (ka is the default)
│  └─ e2e/                  Playwright tests
│
├─ docs/                    Architecture + feature docs (this file)
├─ scripts/deploy-prod.ps1  Manual production deploy (needs explicit approval)
└─ .github/workflows/       Legacy GitHub workflows (code now lives on Azure DevOps)
```

> **Legacy folders.** `Frontend/components/`, `Frontend/context/`,
> `Frontend/lib/` and `Backend/server.ts` (repo-level, not `src/`) are older
> copies. New code goes under `Frontend/src/` and `Backend/src/`. They are
> scheduled for clean-up in a later refactor step.

---

## 3. How a request flows

1. A page in `Frontend/pages/**` calls a function from `Frontend/src/services/<area>Service.ts`.
2. That service uses the shared axios client `apiClient.ts` → `GET/POST /api/<area>/...`.
3. `Backend/src/server.ts` mounts the matching router from `Backend/src/routes/<area>.ts`.
4. The route validates input (`schemas/`), checks auth (`middleware/auth.ts`),
   and calls a service in `Backend/src/services/`.
5. The service talks to the DB through `lib/prisma.ts` and to external providers.

**To find the backend code for a URL:** search `server.ts` for the path prefix
(e.g. `'/api/payments'`) → that tells you the route file.

---

## 4. Feature index — where to look

| Feature | Backend route(s) | Key backend services | Frontend |
|---|---|---|---|
| Auth, registration, OAuth, 2FA/step-up | `routes/auth/` | `utils/stepUpAuth`, `emailService` | `pages/auth/*`, `src/context/AuthContext.tsx` |
| Courses & lessons | `courses/`, `instructorCourses.ts`, `adminCourseModeration.ts` | `coursePricing`, `courseSaleService`, `certificateService` | `pages/courses/**`, `pages/admin/courses.tsx`, `dashboard/instructor-studio` |
| Live trainings | `liveTrainings.ts`, `adminLiveTrainings*.ts`, `liveTrainingInvites.ts`, `trainingGuides.ts` | `liveTrainingSaleService`, `liveTrainingPricing`, `trainingGuideService` | `pages/live-trainings/**`, `pages/admin/live-trainings/**` |
| Checkout & payments (BOG) | `payments/` (one file per checkout type; webhook in `bogCallback.ts`) | `bogPaymentService`, `paymentGatewayService`, `learningCheckoutService`, `learningPaymentFulfillment`, `paymentReconciliationService` | `pages/payments/bog/result.tsx` |
| Payments (Stripe) | `stripePayments.ts` | `stripePaymentService`, `subscriptionStateService` | `pages/payments/stripe/result.tsx` |
| Billing, invoices, wallet, payouts | `billing.ts`, `invoices.ts`, `wallet.ts`, `adminPayouts.ts`, `adminFinance.ts` | `billingService`, `invoiceService`, `bogPayoutService` | `dashboard/billing.tsx`, `wallet.tsx` |
| Digital store (products) | `products.ts`, `adminProducts.ts`, `productReviews.ts` | `productSaleService`, `productPricing`, `productFileDelivery`, `productImageProtection` | `pages/store/**`, `pages/marketplace/` |
| Gigs, vacancies, escrow | `gigs.ts`, `vacancies.ts`, `directOffers.ts`, `orders.ts` | `escrowService`, `gigApprovalService` | `pages/gigs/**`, `pages/vacancies/**` |
| Mentorship | `mentorship.ts`, `mentorApplications.ts`, `adminMentorship.ts` | `mentorshipEscrowService`, `mentorAvailabilityService` | `pages/mentors.tsx`, `dashboard/mentorship*.tsx` |
| HR support | `hrSupport.ts`, `adminHRSupport.ts` | `hrSupportEscrowService`, `hrPricingService` | `dashboard/hr-support/**` |
| Exams & proctoring | `examProctoring.ts`, `proctoredPractice.ts`, `freelancerExam.ts`, `skillTests.ts` | `examProctoringService`, `examSessionService`, `aiExamService`, `sessionAnomalyService` | `pages/exam/**`, `src/components/dashboard/ExamProctoringTab.tsx` |
| Children's book | `childrensBook.ts`, `bookAnimation.ts` | `book*Service` files | `dashboard/tools/childrens-book*`, `pages/book/[token].tsx` |
| Educator Hub / AI tools | `educatorHub.ts`, `mediaStudio.ts`, `aiAgentsSuite.ts`, `ai.ts`, `tts.ts` | `aiAgentService` (central AI fallback chain), `educatorHubAiService`, `azureSpeechService` | `dashboard/tools/**` |
| Iako assistant | `iako.ts`, `adminIako.ts` | `iakoAssistantService`, `iakoKnowledgeService` | `src/components/iako/` |
| English tutor | `englishTutor.ts`, `adminEnglishTutor.ts` | `englishTutorService`, `englishTutor*Service` | `dashboard/english-tutor/` |
| Messages & chat moderation | `messages.ts`, `chatRequests.ts`, `adminChatModeration.ts` | `chatConsentService`, `contentModerationService` | `pages/messages/` |
| Blog, CMS, site content | `blog.ts`, `adminBlog.ts`, `adminCms.ts`, `siteContent.ts` | `blogAgentService`, `blogSlugService` | `pages/blog/**`, `pages/admin/blog.tsx` |
| Forum / community | `forum.ts`, `adminForum.ts` | — | `pages/forum/**`, `community.tsx` |
| Notifications & e-mail | `notifications.ts`, `adminNotifications.ts` | `emailService`, `whatsappService` | `dashboard/notifications.tsx` |
| Admin panel (general) | `admin.ts`, `adminPanel.ts`, `admin*.ts` | `auditLogService`, `accessGrantService` | `pages/admin/**` |
| Gift cards & promos | `giftCards.ts`, `adminGiftCards.ts`, `promos.ts`, `adminPromos.ts` | `giftCardService`, `couponService` | `pages/gift-cards/**` |
| File storage | `upload.ts` | `services/storage/` (Azure Blob / Bunny / local adapters), `privateBlobStorage` | `src/utils/imageUpload.ts` |
| Scheduled jobs | `cron.ts` | `utils/scheduler.ts`, `listingExpiryService`, `accountCleanupService` | — |

---

## 5. Conventions

- **Routes stay thin.** HTTP parsing, auth and validation live in `routes/`;
  anything reusable or money-related belongs in `services/`.
- **One PrismaClient.** Always import `prisma` from `Backend/src/lib/prisma.ts`.
- **AI calls** go through `aiAgentService.callTextModel()` so the multi-vendor
  fallback applies.
- **Translations:** user-visible text goes into `Frontend/public/locales/*/<ns>.json`;
  run `npm --workspace Frontend run check:locales` after adding keys.
- **File header comment:** every non-trivial file starts with a short block
  saying what it is for and what it is *not* for, e.g.

  ```ts
  /**
   * Course checkout (BOG) — creates the gateway order and the pending payment row.
   * Fulfillment after the gateway callback lives in learningPaymentFulfillment.ts.
   */
  ```

  Inside the file, comment the *why* of non-obvious logic (business rules,
  race conditions, provider quirks), not what each line does.
- **Size guideline:** aim for files under ~400 lines. When a file grows past
  that, split it by sub-feature into a folder with an `index.ts`.

---

## 6. Checks before every commit

```bash
cd Backend && npx tsc --noEmit && npm test && npm run build
cd Frontend && npx tsc --noEmit && npm run build
```

Production deploys go only through `scripts/deploy-prod.ps1`, with explicit
approval. Code is hosted on Azure DevOps (`azure` remote); `main` there is the
live code.
