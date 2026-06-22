/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'cursor-dark': '#0f172a',
        'cursor-orange': '#f54e00',
        'cursor-orange-hover': '#e04400',
        error: '#dc2626',
        success: '#059669',
      },
      fontFamily: {
        gothic: 'var(--font-gothic)',
        serif: 'var(--font-serif)',
        mono: 'var(--font-mono)',
        system: 'var(--font-system)',
      },
      borderRadius: {
        comfortable: '10px',
        featured: '16px',
        pill: '9999px',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
}
