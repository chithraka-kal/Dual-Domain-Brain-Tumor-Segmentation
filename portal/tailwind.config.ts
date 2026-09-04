import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-dark': 'var(--color-primary-dark)',
        primary: 'var(--color-primary)',
        'surface-alt': 'var(--color-surface-alt)',
        background: 'var(--color-background)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(9,93,126,0.08), 0 4px 16px -2px rgba(9,93,126,0.06)',
        'card-hover': '0 4px 20px -2px rgba(9,93,126,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out both',
        'slide-up': 'slideUp 0.5s ease-out both',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}

export default config
