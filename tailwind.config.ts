import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sig: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          500: '#4CAF50',
          700: '#2E7D32',
        },
        // Semantic tokens via CSS vars
        surface: {
          base: 'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
          sunken: 'var(--bg-sunken)',
          sidebar: 'var(--bg-sidebar)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
        },
        brand: {
          primary: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          muted: 'var(--brand-muted)',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
