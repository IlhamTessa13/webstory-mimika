/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0e1116',
        panel: '#161b22',
        ink: '#e6edf3',
        muted: '#8b949e',
        accent: '#ff6b35',
        accent2: '#2ea8ff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        story: '1100px',
      },
    },
  },
  plugins: [],
}
