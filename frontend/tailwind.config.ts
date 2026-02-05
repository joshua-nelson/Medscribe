import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Clinical Warmth palette
        primary: {
          50: '#E8F4F4',
          100: '#C5E4E4',
          200: '#9DD1D1',
          300: '#74BDBD',
          400: '#4FA9A9',
          500: '#0F5757',
          600: '#0D4A4A',
          700: '#0A3D3D',
          800: '#082F2F',
          900: '#052222',
        },
        slate: {
          850: '#1E2D3D',
          950: '#0F1A24',
        },
        amber: {
          accent: '#C9A66B',
          light: '#E8D5B5',
        },
        warm: {
          50: '#FDFCFA',
          100: '#F8F6F3',
          200: '#F0EDE8',
          300: '#E5E0D8',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
      animation: {
        'wave': 'wave 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.5)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
