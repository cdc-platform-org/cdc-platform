# About Us hub

The public navigation now links to `/about`, `/about/gallery`, `/about/projects`, `/about/success-stories` and `/about/partners`, while retaining Terms & Conditions. Each route has Georgian and English copy, localized metadata, CDC light/dark colours and a shared responsive editorial shell. Legacy `/gallery`, `/projects`, `/success-stories`, trainer profiles and their admin editors remain available.

`/admin/cms/about` manages this curated About hub through the existing `SiteContent` record with key `about`. SUPER_ADMIN and MANAGER are authorized by the existing CMS middleware. The editor includes both languages, image upload/preview, categories, project dates and partners, outcome metrics, team profiles, accreditation/document links, deletion, and explicit illustrative labels. Saving publishes the whole hub; tab changes retain unsaved edits. Images use the existing admin image uploader. Curated About entries are separate from legacy gallery/project/story records.

The public pages use the bundled bilingual seed when no record exists. Explicitly empty collections stay empty. Fetch failures show a localized retry state; malformed legacy content is not silently overwritten by the admin editor. Backend validation requires both languages, valid categories and dates, unique entry IDs and safe links. No database migration is required.

## Starter content and seeding

`Frontend/src/data/aboutHubSeed.json` is the seed source and public fallback. Its sample events, projects, career journeys, team-role placeholders and impact numbers are explicitly marked illustrative. The existing center mission/founding information and HEKS/EPER support are retained. No accreditation or fictional graduate/employer endorsement is asserted. Administrators replace the examples and remove illustrative labels only after verification.

Run from `Backend` in a checkout containing both packages:

```powershell
node node_modules/ts-node/dist/bin.js --project tsconfig.seed-about.json scripts/seedAbout.ts
```

Equivalent package script: `db:seed:about`. The script validates the seed and creates the `about` row only when missing; it never overwrites saved content or repopulates intentionally empty collections. It was verified against the disposable test database. No production database was seeded.

## Verification

`Frontend/playwright.about.config.ts` runs the dedicated browser suite without the global login setup. Set `PLAYWRIGHT_BASE_URL` to a local preview server; its default is port 3112. The suite covers all five routes in KA/EN on desktop/mobile and both themes, overflow, client hydration, gallery categories and keyboard lightbox, project sorting, empty/error states, navigation and the admin edit/upload/publish/delete flow. Provider calls are mocked; CMS persistence and authorization are tested separately against PostgreSQL in `Backend/src/routes/__tests__/aboutHubCms.test.ts`.

## Image sources

The overview uses the repository's existing `/images/heks-eper.jpg`. Locally bundled example photographs under `/images/about/` are stock illustrations, marked as such with their sample entries. Source image IDs:

- collaboration.jpg: https://images.unsplash.com/photo-1522071820081-009f0129c71c
- workshop.jpg: https://images.unsplash.com/photo-1516321318423-f06f85e504b3
- bootcamp.jpg: https://images.unsplash.com/photo-1519389950473-47ba0277781c
- community.jpg: https://images.unsplash.com/photo-1521737711867-e3b97375f902

Source terms: [Unsplash License](https://unsplash.com/license). These stock photos do not document CDC events or identify actual graduates or partners.
