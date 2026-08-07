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
      // `heading`: temporary Noto Sans Georgian stand-in (next/font/google
      // CSS variable, see pages/_app.tsx) until GL-Kirovi is replaced.
      // `sans` (body text/inputs): still the original @font-face.
      fontFamily: {
        heading: ['var(--font-heading)', 'Fira GO', 'sans-serif'],
        sans: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
      },
    },
  },
  plugins: [],
}