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
      // `heading`: Noto Sans Georgian (next/font/google CSS variable, see
      // pages/_app.tsx) — one consistent typeface across Georgian+Latin,
      // chosen after three custom local faces (BPG Banner, MS Ring,
      // GL-Kirovi) each ran into a real production problem. `sans` (body
      // text/inputs): still the original @font-face — unrelated, unchanged.
      fontFamily: {
        heading: ['var(--font-heading)', 'Fira GO', 'sans-serif'],
        sans: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
      },
    },
  },
  plugins: [],
}