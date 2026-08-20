-- Backfills DigitalProduct.howItWorksSteps (new nullable column, see the
-- schema migration this follows) for the seeded "7-Day AI Business
-- Assistant Trial" product (20260807010000_seed_ai_business_trial_product)
-- with exactly the copy pages/store/[id].tsx already hardcoded for it
-- (public/locales/*/marketplace.json's aiStep1/2/3 keys) — so turning on
-- the new admin-editable panel doesn't change what visitors see until an
-- admin actually edits it. Built with jsonb_build_array/object rather than
-- a raw string literal to avoid hand-escaping quotes in the body text.
-- No-ops harmlessly if this product id doesn't exist in a given database
-- (WHERE clause just matches zero rows).
UPDATE "digital_products"
SET "howItWorksSteps" = jsonb_build_array(
  jsonb_build_object(
    'icon', 'Zap',
    'titleKa', 'გააქტიურება',
    'titleEn', 'Activate',
    'bodyKa', 'დააჭირეთ «უფასოდ მიღებას», მიაბით ბარათი (0 ₾-იანი ვერიფიკაციის დაჭერით) და გაიარეთ 10-დღიანი ულიმიტო საცდელი პერიოდი.',
    'bodyEn', 'Click "Get for Free", bind a card (a zero-cost verification hold), and get a 10-day unlimited trial period.'
  ),
  jsonb_build_object(
    'icon', 'Upload',
    'titleKa', 'მონაცემების მართვა',
    'titleEn', 'Manage Your Data',
    'bodyKa', 'დაშბორდში ატვირთეთ თქვენი კომპანიის PDF/DOCX ფაილები ან FAQ ტექსტი AI-ს გადასასწავლებლად.',
    'bodyEn', 'Upload your company''s PDF/DOCX files or FAQ text in the dashboard to train the AI.'
  ),
  jsonb_build_object(
    'icon', 'Code2',
    'titleKa', 'საიტზე ჩაშენება',
    'titleEn', 'Embed on Your Site',
    'bodyKa', 'დააკოპირეთ თქვენი უნიკალური 1-სტრიქონიანი Embed Script კოდი, ჩასვით თქვენს საიტზე და AI ასისტენტი მყისიერად გააქტიურდება!',
    'bodyEn', 'Copy your unique 1-line Embed Script, paste it into your site, and the AI assistant activates instantly!'
  )
)
WHERE "id" = 'a5f877bb-6875-448a-ac00-40f09d3e2ca3';
