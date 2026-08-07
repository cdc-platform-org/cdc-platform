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
      // Custom Georgian typeface (see the @font-face + h1/h2/h3 rule in
      // pages/_app.tsx, which already applies it site-wide via !important).
      // Exposed here too as an explicit `font-heading` utility for any
      // element that wants the heading typeface without being an h1-h3.
      fontFamily: {
        heading: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
        sans: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
      },
    },
  },
  plugins: [],
}