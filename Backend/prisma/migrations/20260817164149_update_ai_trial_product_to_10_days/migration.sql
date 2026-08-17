-- Data-only migration: the seeded AI Business Assistant marketplace listing
-- (see 20260807010000_seed_ai_business_trial_product) said "7-Day" trial,
-- which is now stale — the unified billing engine's trialDays default is 10
-- (see BillingSettings). Updates the fixed-id row in place rather than a
-- new INSERT, same row this app has always pointed store/[id].tsx at.
UPDATE "digital_products"
SET
  "title" = '10-დღიანი AI ბიზნეს ასისტენტი (Trial)',
  "description" = 'სრული წვდომა CDC-ს AI ავტომატიზაციისა და ანალიტიკის ინსტრუმენტებზე 10 დღის განმავლობაში ვერიფიცირებული ბიზნესებისთვის.'
WHERE "id" = 'a5f877bb-6875-448a-ac00-40f09d3e2ca3';
