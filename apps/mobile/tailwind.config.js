/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Light-mode B2C palette mirroring the web app.
        background: '#ffffff',
        foreground: '#0f172a',     // slate-900
        primary: '#2563eb',        // blue-600
        'primary-foreground': '#ffffff',
        muted: '#64748b',          // slate-500 — used as muted foreground
        'muted-bg': '#f8fafc',     // slate-50
        accent: '#f1f5f9',         // slate-100
        border: '#e2e8f0',         // slate-200
        ring: '#2563eb',
        destructive: '#dc2626',
        success: '#16a34a',
        warning: '#d97706',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
}
