# CDC Platform — Project Context

Master reference for the platform's major subsystems. This complements `CLAUDE.md` (agent operating rules) rather than replacing it — this file documents *what the system does and how*, not how an agent should behave while working on it.

Stack: Express + Prisma (Backend), Next.js Pages Router + next-i18next (Frontend). Money is stored as `Int` minor units (tetri/cents) throughout — never `Float` — to avoid floating-point rounding on real currency values.

---

## Digital Rights & Copyright Protection

Three independent layers protecting Digital Store listings, added because the original upload flow stored both preview images and purchasable files on the same public, unauthenticated Bunny CDN path.

**Preview image protection** (`Backend/src/services/productImageProtection.ts`) — runs only on `products.ts`/`adminProducts.ts`'s `/upload-image`, never on the shared `imageStorage.ts` used by avatars/course thumbnails/blog covers:
- Resizes to a 1600px longest-edge cap (`MAX_PREVIEW_DIMENSION`) — a legible preview, not a sellable-quality export.
- Tiles a diagonal, semi-transparent "CDC.ORG.GE" watermark (`sharp` SVG composite, `tile: true`) across the full frame.
- Recompresses to JPEG at quality 82. Never throws — a processing failure falls back to storing the original buffer untouched.

**Private file delivery** (`Backend/src/services/productFileDelivery.ts` + `privateBlobStorage.ts`) — `/upload-file` now stores purchasable assets in the same private Azure Blob container `routes/upload.ts` already used for lesson videos (no anonymous reads; `DefaultAzureCredential` managed identity, no shared keys). `DigitalProduct.fileUrl` holds a `cdcblob://<blobName>` marker instead of a real URL; `GET /products/:id/download` mints a fresh 15-minute user-delegation-key-signed SAS URL from it (`DOWNLOAD_SAS_EXPIRY_MINUTES`), only after verifying a `COMPLETED` `ProductPurchase`. Pre-existing rows or an admin-pasted external URL pass through unchanged — same protection level they always had, not a regression. The marker format was chosen specifically to avoid a breaking schema/contract change: it still satisfies `z.string().url()` and every existing Frontend call site that reads `fileUrl`.

**License metadata** (`ProductLicenseType` enum: `PERSONAL_USE` / `COMMERCIAL_USE` / `EXTENDED_COMMERCIAL`) — `DigitalProduct.licenseType` defaults to the most restrictive option (`PERSONAL_USE`). Snapshotted onto `ProductPurchase.licenseType` at fulfillment time (`productSaleService.ts`'s `completeProductPurchase`, and the free `/:id/claim` path) so a later catalog edit to the license never retroactively changes what an existing buyer already purchased. Surfaced on the store product page, both submission forms, and the buyer's download view.

---

## Flexible Pricing Engine

`DigitalProduct.discountedPrice` (absolute minor-unit sale price) + `saleEndsAt`, computed at *read time* via `Backend/src/services/productPricing.ts` — never a cron job; an expired sale reverts to `price` automatically the next time it's read. Mirrors the pre-existing `Course.discountPercent`/`discountEndDate` pattern (`coursePricing.ts`) in shape, but deliberately a separate mechanism: a Digital Store seller sets an absolute floor price, not a percentage, and only `DigitalProduct` has a per-item creator commission split.

**Validation** (`productPricing.ts`'s `validateProductDiscount`, mirrored client-side in `productService.ts` for real-time form feedback):
- Must be a genuine reduction (`discountedPrice < price`).
- **2 GEL absolute floor** (`MIN_SALE_PRICE_MINOR = 200`) — covers BOG/Stripe per-transaction processing fees, shared with Course's own discount validation (`courseSchemas.ts`'s `validateCourseDiscount`) so the floor can't drift between the two mechanisms.
- **80% maximum discount** (`MAX_DISCOUNT_PERCENT`) — specific to `DigitalProduct`; `Course` keeps its own pre-existing, independent 90% cap unchanged.

**Checkout sync**: both BOG (`routes/payments.ts`) and Stripe (`routes/stripePayments.ts`) product checkout now charge `getCurrentProductPrice(product)` instead of the flat original price. The platform's 20% commission (`productSaleService.ts`) applies to whatever is actually charged — a 5 GEL sale nets the creator 4 GEL, same math as full price, no special-cased discount handling downstream.

Sale badges (`-X%`) and crossed-out original pricing are rendered on the marketplace listing, the product detail page, and the admin moderation queue.

---

## Post-Login Purchase Continuity

This app's guest auth flow is an **in-place modal** (`AuthModalContext`), not a `/login` page redirect — there is no `redirect`/`next` query-parameter pattern anywhere in this stack.

`openAuthModal({ onSuccess })` accepts a callback invoked with the freshly-authenticated user once login succeeds. The Digital Store product page (`pages/store/[id].tsx`) now wires this the same way course enrollment already did (`courses/[id]/index.tsx`'s `startCheckout`/`handleEnroll`): each buy/claim action is split into a pure action (`startCheckout`/`startClaim`, no auth check inside — a self-check there would read a stale `isAuthenticated` closure captured before login) and a gated dispatcher that either calls the action directly or opens the modal with it as `onSuccess`. A guest who logs in mid-purchase now resumes straight into checkout instead of landing back on the page having to click Buy again.

---

## Multi-Vendor AI Resilience

`Backend/src/services/aiAgentService.ts`'s `callTextModel()` is the single choke point every AI feature (blog drafts, product moderation, grant scouting, marketing copy, exam generation, etc.) goes through — no caller constructs its own model client.

Fallback sequence, verified against the live implementation:
1. `gemini-flash-latest`
2. `gemini-flash-lite-latest`
3. `gemini-3.5-flash`
4. Azure OpenAI GPT-4o (`azureOpenAiService.ts`) — the "4th rung," tried only after all three Gemini models fail with a retryable error (503/429), or immediately if `GEMINI_API_KEY` isn't configured at all.

Each Gemini model gets up to 2 attempts with a delay between them before falling through to the next model; a non-retryable error (e.g. a malformed prompt) breaks out of the whole Gemini loop immediately rather than burning through all three models pointlessly. The Azure fallback covers text-only calls — vision/inline-image requests have no cross-vendor fallback (an explicit, documented scope boundary, not a silent gap).

---

## B2B Escrow Flow

Gig proposals are gated on `User.isVerifiedGraduate` (`routes/gigs.ts`) — set either by passing the freelancer skill exam or completing a CDC course. `services/escrowService.ts` applies the same `PLATFORM_COMMISSION_RATE = 0.2` (20%) split as the Digital Store's own commission constant — independently defined in each service rather than shared, since they're two separate revenue streams that happen to share a number today, not one policy.

---

## i18n Coverage

6 locales: `ka` (default), `en`, `de`, `es`, `fr`, `uk` (`next-i18next.config.js`). Verified via direct key count across every locale's JSON namespace files: **658 keys per locale**, full structural parity — every locale defines the same key set, including i18next's `{{count}}`/`_Plural` pluralization pairs (e.g. `resultsCount`/`resultsCountPlural`).

Structural parity is not the same as translation completeness: `ka` and `en` are hand-authored; `de`/`es`/`fr`/`uk` were widened from ka/en-only dict objects with an **English fallback** for newer strings, not native translations, by deliberate scope decision (real de/es/fr/uk copy for legal/payment/certificate text needs native review and was explicitly left for later). Real external constraints — the BOG payment gateway's own language, AI-generated exam/skill-test content, and DB content (blog/mentor/success-story/studio-case) stored only in ka/en — stay 2-way at their call sites rather than being force-widened.

---

## Change Log Reference

| Capability | Key files |
|---|---|
| Preview watermarking | `Backend/src/services/productImageProtection.ts` |
| Private file delivery | `Backend/src/services/privateBlobStorage.ts`, `productFileDelivery.ts` |
| License metadata | `ProductLicenseType` (schema), `productSaleService.ts` |
| Discount pricing | `Backend/src/services/productPricing.ts`, `pricingRules.ts` |
| Course discount floor | `Backend/src/services/coursePricing.ts`, `schemas/courseSchemas.ts` |
| Checkout price sync | `Backend/src/routes/payments.ts`, `stripePayments.ts` |
| Purchase continuity | `Frontend/pages/store/[id].tsx`, `src/context/AuthModalContext.tsx` |
| AI fallback chain | `Backend/src/services/aiAgentService.ts` |
| Sales count | `DigitalProduct.salesCount` (schema), `productSaleService.ts`, `products.ts`'s `/:id/claim` |
