/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: '#FAF9F6',
          sidebar: '#F3F0E9',
          border: '#E2DEC5',
          text: '#3B3833',
        },
        mastery: {
          strong: {
            bg: '#F0F4EF',
            border: '#8F9E8B',
            text: '#4E5A4A',
          },
          medium: {
            bg: '#FAF5EE',
            border: '#C5B49B',
            text: '#766751',
          },
          weak: {
            bg: '#FAF0EE',
            border: '#C58F84',
            text: '#7C4940',
          },
          unstarted: {
            bg: '#F5F3ED',
            border: '#BEB7A4',
            text: '#686253',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
