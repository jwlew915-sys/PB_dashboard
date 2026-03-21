/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#C8102E', light: '#E8001A', dark: '#9A0C23' }
      }
    }
  },
  plugins: []
}
