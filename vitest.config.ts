import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./lib/__tests__/setup.ts'],
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    // Globs válidos (con **/...). Los patrones viejos ('node_modules/', etc.) NO
    // eran globs -> vitest escaneaba node_modules y .claude/worktrees (tests fantasma).
    exclude: ['**/node_modules/**', '**/.next/**', '**/supabase/**', '**/e2e/**', '**/.claude/**', '**/.opencode/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/.next/**', '**/supabase/**', '**/e2e/**', '**/.claude/**', '**/.opencode/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
