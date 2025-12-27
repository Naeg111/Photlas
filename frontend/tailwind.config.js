import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        '.touch-callout-none': {
          '-webkit-touch-callout': 'none',
        },
        '.user-drag-none': {
          '-webkit-user-drag': 'none',
        },
      })
    }),
  ],
}
