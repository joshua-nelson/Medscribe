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
        background: '#F7FAF8',
        foreground: '#132019',
        muted: '#EAF1EC',
        'muted-foreground': '#5C6F63',
        accent: '#8C00FF',
        'accent-secondary': '#B066FF',
        card: '#FFFFFF',
        border: '#D4E0D8',
        ring: '#8C00FF',
        // Clinical Warmth palette
        primary: {
          50: '#F5E8FF',
          100: '#E9CCFF',
          200: '#D8A3FF',
          300: '#C678FF',
          400: '#AD45FF',
          500: '#8C00FF',
          600: '#7600D9',
          700: '#6100B3',
          800: '#4B008C',
          900: '#350066',
        },
        slate: {
          850: '#1D2A23',
          950: '#101713',
        },
        amber: {
          accent: '#C08A5A',
          light: '#E7CDB5',
        },
        warm: {
          50: '#FAFBFA',
          100: '#F2F5F2',
          200: '#E5EBE6',
          300: '#D2DDD4',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Source Sans 3', 'system-ui', 'sans-serif'],
        'mm-display': ['Fraunces', 'Georgia', 'serif'],
        'mm-body': ['Source Sans 3', 'system-ui', 'sans-serif'],
        'mm-mono': ['ui-monospace', 'monospace'],
      },
      animation: {
        wave: 'wave 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'rotate-slow': 'rotateSlow 60s linear infinite',
        'float-card': 'floatCard 5s ease-in-out infinite',
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
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.3)', opacity: '0.7' },
        },
        rotateSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        floatCard: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
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
