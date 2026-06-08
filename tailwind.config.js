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
        // === PREMIUM LIGHT SURFACE LADDER ===
        'bg-base':      '#F6F9FC',
        'bg-surface':   '#F8FBFF',
        'bg-card':      '#FFFFFF',
        'bg-elevated':  '#F8FBFF',
        'bg-overlay':   '#FFFFFF',

        // === BRAND ACCENTS ===
        'brand-orange':       '#FF6A14',
        'brand-orange-dim':   '#F45C08',
        'brand-orange-glow':  '#FFF1E8',
        'brand-orange-border': '#FDBA74',

        'brand-teal':         '#14B8A6',
        'brand-teal-dim':     '#0F766E',
        'brand-teal-glow':    '#E6FFFA',
        'brand-teal-border':  '#99F6E4',

        'brand-gold':         '#F59E0B',
        'brand-gold-dim':     '#D97706',
        'brand-gold-glow':    '#FEF3C7',

        'brand-purple':       '#7C5CFF',
        'brand-purple-glow':  '#EEF2FF',

        // === SEMANTIC COLORS ===
        'answer-correct':     '#16A34A',
        'answer-correct-bg':  '#DCFCE7',
        'answer-wrong':       '#EF4444',
        'answer-wrong-bg':    '#FEE2E2',
        'answer-skip':        '#6B7280',

        // === TEXT ===
        'text-primary':    '#0F172A',
        'text-secondary':  '#475569',
        'text-muted':      '#64748B',
        'text-disabled':   '#94A3B8',

        // === BORDERS ===
        'border-subtle':   '#E2E8F0',
        'border-medium':   '#CBD5E1',
        'border-strong':   '#94A3B8',
        'border-orange':   '#FDBA74',
        'border-teal':     '#99F6E4',
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
          '0%, 100%': { boxShadow: '0 0 16px rgba(20,184,166,0.3)' },
          '50%': { boxShadow: '0 0 28px rgba(20,184,166,0.6)' },
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
