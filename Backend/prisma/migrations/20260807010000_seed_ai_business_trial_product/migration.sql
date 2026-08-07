-- Seed: "7-Day AI Business Assistant Trial" digital product — admin-created
-- (submittedById NULL, status APPROVED directly), same convention as
-- routes/adminProducts.ts's POST /. Discoverable in /marketplace under the
-- "ბიზნეს ინსტრუმენტები" category; purchase/claim is restricted to
-- verified Business accounts client-side (see pages/store/[id].tsx).
--
-- fileUrl points at the in-app AI Tools dashboard (a relative path, opened
-- via window.open on "claim") rather than a real downloadable file — this
-- product represents trial access to an in-app tool, not a file, and
-- DigitalProduct has no separate "grants a feature entitlement" concept.
-- Claiming this $0 product does NOT itself change any access rights —
-- access to /dashboard/ai-tools remains governed solely by the user's own
-- role/verification state, independent of this purchase record.
INSERT INTO "digital_products" (
  "id", "title", "description", "price", "category", "imageUrl", "fileUrl",
  "downloadsCount", "createdAt", "status", "submittedById"
) VALUES (
  'a5f877bb-6875-448a-ac00-40f09d3e2ca3',
  '7-დღიანი AI ბიზნეს ასისტენტი (Trial)',
  'სრული წვდომა CDC-ს AI ავტომატიზაციისა და ანალიტიკის ინსტრუმენტებზე 7 დღის განმავლობაში ვერიფიცირებული ბიზნესებისთვის.',
  0,
  'ბიზნეს ინსტრუმენტები',
  'https://cdc-storage.b-cdn.net/products/ai-business-trial-cover-1786082013.jpg',
  '/dashboard/ai-tools',
  0,
  now(),
  'APPROVED',
  NULL
);
