/** @type {import('tailwindcss').Config} */
// URBAN Design System — nilai token ada di src/index.css (:root & .dark), dokumentasi di src/ui/DESIGN.md.
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: rgb('--ui-canvas'),
        surface: { DEFAULT: rgb('--ui-surface'), 2: rgb('--ui-surface-2') },
        fill: 'var(--ui-fill)',
        label: { DEFAULT: rgb('--ui-label'), 2: rgb('--ui-label-2'), 3: rgb('--ui-label-3') },
        sep: 'var(--ui-sep)',
        edge: 'var(--ui-edge)',
        positive: rgb('--ui-positive'),
        negative: rgb('--ui-negative'),
        warning: rgb('--ui-warning'),
        tint: rgb('--ui-tint'),
      },
      fontSize: {
        display: ['34px', { lineHeight: '40px', letterSpacing: '-0.012em', fontWeight: '700' }],
        title1: ['28px', { lineHeight: '34px', letterSpacing: '-0.012em', fontWeight: '700' }],
        title2: ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
        title3: ['20px', { lineHeight: '25px', letterSpacing: '-0.01em', fontWeight: '600' }],
        headline: ['17px', { lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '600' }],
        body: ['17px', { lineHeight: '22px', letterSpacing: '-0.01em' }],
        callout: ['16px', { lineHeight: '21px', letterSpacing: '-0.006em' }],
        subhead: ['15px', { lineHeight: '20px', letterSpacing: '-0.004em' }],
        footnote: ['13px', { lineHeight: '18px' }],
        caption: ['12px', { lineHeight: '16px' }],
        caption2: ['11px', { lineHeight: '13px', letterSpacing: '0.006em', fontWeight: '500' }],
      },
      borderRadius: {
        card: '22px',
        tile: '14px',
        field: '12px',
        control: '10px',
        icon: '7px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.03)',
        float: '0 10px 30px rgba(0, 0, 0, 0.14)',
      },
    },
  },
  plugins: [],
}
