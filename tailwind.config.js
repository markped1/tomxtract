/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{ts,tsx,html}',
    './src/admin/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        'cyber-bg':      '#0b0f19',
        'cyber-card':    '#111827',
        'cyber-surface': '#161b2c',
        'cyber-text':    '#e5e7eb',
        'cyber-accent':  '#00f0ff',
        'cyber-border':  '#1f2937',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
