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
