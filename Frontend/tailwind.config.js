/** @type {import('tailwindcss').Config} */
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
        brand: {
          cyan: '#06b6d4',
          purple: '#7c3aed',
          darkBg: '#0b0f19',
        }
      },
      // `heading`: BPG Banner (next/font/local, --font-heading), with a
      // real self-hosted Inter (next/font/google, --font-fallback) — not
      // just the bare string 'Inter' — as the fallback before generic
      // sans-serif. Both CSS vars are set on the wrapper div in
      // pages/_app.tsx; see the comment there for why the fallback exists.
      // `sans` (body text/inputs): still the original @font-face —
      // unrelated to this, unchanged.
      fontFamily: {
        heading: ['var(--font-heading)', 'var(--font-fallback)', 'sans-serif'],
        sans: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
      },
    },
  },
  plugins: [],
}