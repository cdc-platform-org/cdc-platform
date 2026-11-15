# Editable vector logos

`VECTOR_LOGOS` adds a category to `/admin/product-agent`. Existing settings
retain their counts; the new category starts at **0/day**. Default product
price is **15 GEL**, editable on the normal admin product screen. The estimated
text-model cost is $0.05/run; actual Azure usage is recorded by the existing
runner. No paid image generation is used for logo previews.

The agent requests an original geometric mark for a fictional business.
Validated rectangle, ellipse and line primitives plus real FiraGO text form
one `cdc-template/1` document with six pages: KA/EN × color/black/white.
All symbol parts, names and taglines remain editable in the existing editor.
This version creates geometric logo templates; it does not trace uploaded
raster images or provide freehand node editing.

Products enter the existing **PENDING** approval queue and use the existing
private, purchase-gated file delivery and template-copy flow. Each contains
six standalone SVGs (embedded fonts, editable text and shapes), six 1800px PNGs
with transparent backgrounds, a bilingual README and the FiraGO font license.
Listings identify these as non-exclusive templates with example brand names.
The existing Logos & design navigation filter includes the new store category.

The editor now offers SVG for pages containing only text and vector shapes,
plus a transparent-background option for SVG/PNG. SVG exports POST the current
document (including unsaved edits) to `/api/designs/:id/export-svg` and recheck
ownership and completed purchase. Raster pages keep PNG/PDF exports. Raw SVG,
external image sources and model-supplied markup are never accepted by this
renderer. Fonts ship in the SVG; vector editors that ignore embedded fonts
may require FiraGO to be installed.

The agent page opts into a responsive AdminLayout with a collapsible mobile
menu. Other admin pages retain their existing layout. No database migration
is needed (category and daily counts are existing string/JSON fields).

Validation: backend generator/publishing/ownership tests, design API
regressions, KA/EN Playwright flows for desktop/mobile (text/color changes,
SVG request, transparent PNG pixels, page selection, category settings and
market discovery), backend/frontend typecheck and production builds.
All provider and storage calls in tests are mocked. Only the disposable local
test database is used by integration tests.
