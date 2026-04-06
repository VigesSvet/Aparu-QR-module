/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FC6500',
          dark: '#2A3037',
          muted: '#C6C7C9',
        },
        surface: {
          base: '#F7F7F5',
          white: '#FFFFFF',
          warm: '#FFF7ED',
          light: '#F3F8FA',
        },
        text: {
          primary: '#2A3037',
          muted: '#8D8E93',
          heading: '#464549',
        },
        teal: '#009AA3',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        btn: '8px',
        card: '16px',
      },
      maxWidth: {
        mobile: '480px',
      },
    },
  },
  plugins: [],
}
