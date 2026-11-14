# Editable design templates (`cdc-template/1`)

Digital Store products such as CVs, cover letters, invitations, social posts,
price lists, business cards, planners and worksheets can ship with an
**editable template**. After buying, the customer opens it in the built-in
design editor (`/dashboard/designs`), changes text, fonts, colours and photos,
and downloads a 300 DPI PDF or PNG.

- Validation (source of truth): `Backend/src/schemas/designTemplateSchemas.ts`
- TypeScript mirror: `Frontend/src/types/designTemplate.ts`
- Example: [`sample-cv-ka.json`](sample-cv-ka.json)
- Attach to a product: Admin → Products → **Editable Template** (paste or
  upload the JSON), or `PUT /api/admin/product-templates/:productId`
  (SUPER_ADMIN/MANAGER). `POST /api/admin/product-templates/validate` checks a
  file without saving it.

## Format

```jsonc
{
  "format": "cdc-template/1",
  "title": "CV — classic",
  "locale": "ka",                       // "ka" | "en"
  "page": { "widthMm": 210, "heightMm": 297, "bleedMm": 0, "background": "#ffffff" },
  "fonts": ["FiraGO"],                  // informational
  "pages": [
    {
      "id": "p1",
      "background": "#ffffff",          // or { "imageUrl": "https://…", "color": "#fff" }
      "elements": [ /* drawn in order: first = bottom */ ]
    }
  ]
}
```

Every element has `id` (letters, digits, `_`, `-`; unique per page), `xMm`,
`yMm`, `wMm`, `hMm` (the box **before** rotation, measured from the page's
top-left corner), and optional `rotation` (degrees, around the box centre),
`opacity` (0–1), `editable` (default `true`; `false` = decoration the buyer
cannot select), `locked` (default `false`; `true` = cannot be moved/resized)
and `label` (shown to the buyer in the properties panel, e.g. "სახელი და გვარი").

| type | fields |
|---|---|
| `text` | `text` (use `\n` for new lines), `fontFamily`, `fontSizePt`, `fontWeight` (400/700), `italic`, `underline`, `color` (`#rrggbb`), `align` (`left`/`center`/`right`/`justify`), `lineHeight` (default 1.2), `letterSpacing` (1/1000 em) |
| `image` | `src` (https URL on our CDN), `fit` (`cover`/`contain`), `clip` (`rect`/`circle`), `placeholder` (true for "your photo here" slots) |
| `shape` | `shape` (`rect`/`ellipse`/`line`), `fill`, `stroke` (colour or `null`), `strokeWidthMm`, `radiusMm` (rounded corners) |

### Rules for template authors (people or the AI product agent)

1. **Text must be real text elements**, never baked into a background image —
   otherwise the buyer cannot edit it.
2. **Fonts:** only `FiraGO`, `Noto Sans Georgian`, `Noto Serif Georgian`,
   `Google Sans`, `Literata` (all bundled and Georgian-safe). Anything else is
   rejected.
3. **Images:** https URLs on our own CDN (`BUNNY_CDN_URL`; more hosts via the
   `DESIGN_ASSET_HOSTS` env var). Other hosts are refused when the editor loads
   them. Raster only (JPG/PNG/WebP), no SVG.
4. Text boxes grow downwards with their content; give them a sensible `wMm`
   and place the top edge at `yMm`.
5. Limits: page ≤ 1200 mm per side, ≤ 30 pages, ≤ 150 elements per page,
   ≤ 1.5 MB JSON.
