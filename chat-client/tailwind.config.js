/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Suppress warnings for now since we're using custom SCSS
  corePlugins: {
    preflight: false, // Disable Tailwind's base styles (we use custom ones)
  },
}