/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        pingr: {
          dark:    '#1A1A2E',
          mid:     '#16213E',
          accent:  '#0F3460',
          online:  '#22c55e',
          away:    '#f59e0b',
          offline: '#6b7280',
        }
      }
    }
  },
  plugins: [],
}