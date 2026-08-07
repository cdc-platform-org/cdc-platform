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
      // Custom Georgian typeface (see the @font-face + heading rule in
      // styles/globals.css, applied site-wide via !important).
      fontFamily: {
        heading: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
        sans: ['GL-Kirovi', 'Fira GO', 'sans-serif'],
      },
    },
  },
  plugins: [],
}