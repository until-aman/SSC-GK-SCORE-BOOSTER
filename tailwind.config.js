/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        // === BACKGROUND DEPTH LADDER ===
        'bg-base':      '#0D1B2E',
        'bg-surface':   '#112236',
        'bg-card':      '#172D47',
        'bg-elevated':  '#1E3554',
        'bg-overlay':   '#243D60',

        // === BRAND ACCENTS ===
        'brand-orange':       '#FF6B16',
        'brand-orange-dim':   '#E55E0E',
        'brand-orange-glow':  'rgba(255, 107, 22, 0.15)',

        'brand-teal':         '#14B8A6',
        'brand-teal-dim':     '#0F9488',
        'brand-teal-glow':    'rgba(20, 184, 166, 0.12)',

        'brand-gold':         '#F59E0B',
        'brand-gold-dim':     '#D97706',
        'brand-gold-glow':    'rgba(245, 158, 11, 0.12)',

        'brand-purple':       '#7C5CFF',
        'brand-purple-glow':  'rgba(124, 92, 255, 0.15)',

        // === SEMANTIC COLORS ===
        'answer-correct':     '#22C55E',
        'answer-correct-bg':  'rgba(34, 197, 94, 0.12)',
        'answer-wrong':       '#EF4444',
        'answer-wrong-bg':    'rgba(239, 68, 68, 0.12)',
        'answer-skip':        '#6B7280',

        // === TEXT ===
        'text-primary':    '#F0F4F8',
        'text-secondary':  '#B8C4D4',
        'text-muted':      '#7A8FA6',
        'text-disabled':   '#4A5A6B',

        // === BORDERS ===
        'border-subtle':   'rgba(255, 255, 255, 0.08)',
        'border-medium':   'rgba(255, 255, 255, 0.12)',
        'border-strong':   'rgba(255, 255, 255, 0.20)',
        'border-orange':   'rgba(255, 107, 22, 0.40)',
        'border-teal':     'rgba(20, 184, 166, 0.40)',
      },
      animation: {
        'fadeInDown': 'fadeInDown 0.4s ease-out',
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 2.5s ease-in-out infinite',
        'slideUp': 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'deplete': 'deplete 4s linear forwards',
        'pop-in': 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 16px rgba(16,185,129,0.3)' },
          '50%': { boxShadow: '0 0 28px rgba(16,185,129,0.6)' },
        },
        slideUp: {
          from: { transform: 'translateY(80px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        deplete: {
          from: { width: '100%' },
          to: { width: '0%' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.8) translateY(20px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
