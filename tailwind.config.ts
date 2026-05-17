import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sig: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          500: '#4CAF50',
          700: '#2E7D32',
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        body: ['Poppins', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
