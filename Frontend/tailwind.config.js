/** @type {import('tailwindcss').Config} */
// Tailwind theme for the CDC frontend.
// Design tokens (2026-11 redesign): the brand colours come from the CDC logo
// (cyan / violet / indigo); the light, card-based look is inspired by a
// Figma e-learning template. Raw values live as CSS variables in
// styles/globals.css (:root and .dark) so light/dark switch in one place.

// One brand-tinted neutral scale replaces Tailwind's default `slate` AND
// `gray`. ~8,500 class usages across the app use those two palettes, so
// remapping them here moves every page to the new soft, slightly violet
// neutrals at once (Figma-style #F7F7F8-ish backgrounds, quiet borders,
// violet-navy dark mode that matches the logo) without touching 300 files.
// Shades keep roughly the same lightness as the Tailwind defaults so text
// contrast stays where it was (500 on white ≈ 5:1).
const neutral = {
  50: '#F9F9F7',
  100: '#F2F3F0',
  200: '#E1E3DF',
  300: '#CED2CF',
  400: '#9DA5A4',
  500: '#697174',
  600: '#4F585B',
  700: '#3A4246',
  800: '#282E32',
  900: '#1B1E21',
  950: '#131518',
};

// rgb(var(--x) / <alpha-value>) lets `bg-cdc-primary/10` etc. work.
const token = (name) => `rgb(var(--cdc-${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: neutral,
        gray: neutral,
        brand: {
          cyan: '#06b6d4',
          purple: '#7c3aed',
          darkBg: '#0b0f19',
        },
        // Semantic tokens for new/redesigned components. Prefer these over
        // raw palette classes so dark mode needs no extra `dark:` variants.
        cdc: {
          bg: token('bg'),             // page background
          surface: token('surface'),   // cards, header, panels
          border: token('border'),     // hairline borders
          ink: token('ink'),           // primary text
          muted: token('muted'),       // secondary text
          primary: token('primary'),   // main CTA / active state (violet)
          'primary-hover': token('primary-hover'),
          'primary-soft': token('primary-soft'), // tinted chips/badges bg
          'primary-ink': token('primary-ink'),   // violet for text/icons (lighter in dark mode)
          accent: token('accent'),     // cyan highlight from the logo
          'accent-soft': token('accent-soft'),
        },
      },
      borderRadius: {
        card: '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(21 19 43 / 0.04), 0 1px 1px rgb(21 19 43 / 0.02)',
        'card-hover': '0 12px 32px -12px rgb(76 29 149 / 0.18), 0 2px 6px rgb(21 19 43 / 0.05)',
      },
      // `heading`: BPG ExtraSquare Mtavruli (next/font/local, --font-heading)
      // with a real self-hosted Inter (next/font/google, --font-fallback,
      // weight 600 to match this face's heavier letterforms) as the
      // fallback before generic sans-serif — not the bare string 'Inter'.
      // Both CSS vars are set on the wrapper div in pages/_app.tsx; see the
      // comment there for the known mixed-script-heading tradeoff of this
      // two-font-stack approach. `sans` (body text/inputs): 'GL-Kirovi'
      // removed (its @font-face and font FILE never existed together in
      // this repo — a real production 404 on every page, fixed 2026-09-07,
      // see globals.css's .app-shell comment) — .app-shell's
      // georgianSafeFont already wins on specificity everywhere this
      // matters, so 'Fira GO' is the effective first choice here now.
      fontFamily: {
        heading: ['var(--font-heading)', 'var(--font-fallback)', 'sans-serif'],
        sans: ['var(--font-georgian-safe)', 'var(--font-fallback)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
