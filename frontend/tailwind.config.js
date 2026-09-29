/** @type {import('tailwindcss').Config} */
// Every color maps to a CSS variable (defined per-preset in src/styles/globals.css),
// so a re-color needs zero component changes (docs/PLAYBOOK.md §8.4).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        overlay: 'var(--overlay)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        'accent-dim': 'var(--accent-dim)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        'cat-web': 'var(--cat-web)',
        'cat-crypto': 'var(--cat-crypto)',
        'cat-forensics': 'var(--cat-forensics)',
        'cat-reverse': 'var(--cat-reverse)',
        'cat-pwn': 'var(--cat-pwn)',
        'cat-misc': 'var(--cat-misc)',
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        'chart-6': 'var(--chart-6)',
      },
      fontFamily: {
        mono: 'var(--font-mono)',
        sans: 'var(--font-sans)',
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '8px',
      },
      boxShadow: {
        glow: '0 0 var(--glow-blur) color-mix(in srgb, var(--accent) var(--glow-alpha), transparent)',
      },
      keyframes: {
        blink: { '0%,49%': { opacity: '1' }, '50%,100%': { opacity: '0' } },
        'flag-shake': {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-6px)' },
          '40%,80%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        blink: 'blink 1s steps(1) infinite',
        'flag-shake': 'flag-shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
