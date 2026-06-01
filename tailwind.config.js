/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        mat: {
          900: '#0b1120',
          800: '#121a2e',
          700: '#1b2540',
          600: '#27324f',
        },
        belt: {
          white: '#f4f4f0',
          blue: '#2f6fed',
          purple: '#7c3aed',
          brown: '#7c4a1e',
          black: '#0a0a0a',
        },
        accent: {
          DEFAULT: '#f97316',
          glow: '#fb923c',
        },
        good: '#22c55e',
        bad: '#ef4444',
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(249,115,22,0.6)' },
          '100%': { boxShadow: '0 0 0 14px rgba(249,115,22,0)' },
        },
        // a defended move "shakes" the mat to signal the action was stuffed
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-7px)' },
          '30%': { transform: 'translateX(7px)' },
          '45%': { transform: 'translateX(-5px)' },
          '60%': { transform: 'translateX(5px)' },
          '75%': { transform: 'translateX(-3px)' },
        },
        'stamp-in': {
          '0%': { transform: 'scale(1.6) rotate(-12deg)', opacity: '0' },
          '50%': { transform: 'scale(0.92) rotate(-12deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-12deg)', opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.35s ease-out',
        pop: 'pop 0.3s ease-out',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
        shake: 'shake 0.5s ease-in-out',
        'stamp-in': 'stamp-in 0.3s cubic-bezier(0.2,0.8,0.2,1.4)',
      },
    },
  },
  plugins: [],
}
