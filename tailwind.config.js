/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
  './src/**/*.{js,ts,jsx,tsx,mdx}',
  './pages/**/*.{js,ts,jsx,tsx,mdx}', // just in case
  './components/**/*.{js,ts,jsx,tsx,mdx}',
],
  theme: {
    extend: {},
  },
  plugins: [],
};
