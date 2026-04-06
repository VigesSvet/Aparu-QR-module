/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aparu: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          accent: 'var(--color-accent)',
          accentSoft: 'var(--color-accent-soft)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          border: 'var(--color-border)',
          success: 'var(--color-success)',
          danger: 'var(--color-danger)'
        }
      },
      borderRadius: {
        card: 'var(--radius-card)',
        button: 'var(--radius-button)'
      },
      boxShadow: {
        glow: '0 20px 48px rgba(255, 215, 0, 0.12)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
};
