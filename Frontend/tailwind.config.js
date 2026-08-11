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
      // `heading`: BPG ExtraSquare Mtavruli (next/font/local, --font-heading)
      // with a real self-hosted Inter (next/font/google, --font-fallback,
      // weight 600 to match this face's heavier letterforms) as the
      // fallback before generic sans-serif — not the bare string 'Inter'.
      // Both CSS vars are set on the wrapper div in pages/_app.tsx; see the
      // comment there for the known mixed-script-heading tradeoff of this
      // two-font-stack approach. `sans` (body text/inputs): still the
      // original @font-face — unrelated, unchanged.
      fontFamily: {
        heading: ['var(--font-heading)', 'var(--font-fallback)', 'sans-serif'],
        sans: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
      },
    },
  },
  plugins: [],
}