-- Data migration: migrate the seeded "AI Business Assistant" trial product
-- off the frontend's hardcoded AI_BUSINESS_TRIAL_PRODUCT_ID special-case
-- and onto the new generic toolRoute mechanism, preserving its existing
-- behavior (its fileUrl already pointed at /dashboard/ai-tools, per the
-- original seed migration's own comment).
UPDATE "digital_products"
SET "toolRoute" = '/dashboard/ai-tools'
WHERE "id" = 'a5f877bb-6875-448a-ac00-40f09d3e2ca3';
