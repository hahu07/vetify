/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D6E4D',
          50: '#E8F5F0',
          100: '#C5E6D9',
          200: '#8CCDB8',
          300: '#52B497',
          400: '#289C76',
          500: '#0D6E4D',
          600: '#0A5A3E',
          700: '#084530',
          800: '#053021',
          900: '#031A12',
          dark: '#0A4A34',
        },
        accent: {
          DEFAULT: '#C9A84C',
          50: '#FBF6E9',
          100: '#F5E8C4',
          200: '#EAD18A',
          300: '#DFB950',
          400: '#C9A84C',
          500: '#A8893B',
          600: '#876B2A',
          700: '#664E1C',
          800: '#45320F',
          900: '#241804',
        },
        surface: '#FAFAF9',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
