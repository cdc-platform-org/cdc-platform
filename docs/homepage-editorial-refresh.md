# Homepage visual hierarchy refresh

The hero now pairs concise copy with the existing CDC event slideshow at 840px and above. Smaller screens stack the same content. The 875px layout keeps the course and registration actions in the first viewport, rather than pushing them below a large centered headline. CMS title/subtitle overrides, registration, featured courses, gallery navigation and trailer actions remain supported.

The visual system uses a warm neutral light canvas, graphite dark surfaces, charcoal hero/header actions and restrained CDC violet accents. The beta announcement is a compact support strip. Floating contact controls retain their actions with neutral surfaces; the career promo and English tutor card no longer introduce cyan/violet gradients.

The old inline `_app.tsx` style block forced every heading to 1.65 line-height and expanded letter spacing with `!important`, overriding component typography. It also imposed cyan glow and transform effects. Removing it allows component typography and reduced-motion styles to work as intended. Tailwind's sans stack now uses the existing loaded Georgian/Latin font variables instead of an unmatched `Fira GO` family name.

Validation: Frontend typecheck and production build passed. All 60 dedicated browser checks passed across desktop, the reported 875px width and mobile, including 320px actions, KA/EN, light/dark, CMS overrides, navigation, course pricing/player controls and About/CMS regressions. Run `node node_modules/@playwright/test/cli.js test --config=playwright.design.config.ts` against a local server on port 3113, or set `PLAYWRIGHT_BASE_URL`.

The repository-wide locale parity command still reports pre-existing missing course/detail keys in other locales. This change updates only existing KA/EN values and introduces no new translation keys.
