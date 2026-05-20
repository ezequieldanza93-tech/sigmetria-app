'use client'

import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.theme') as 'light' | 'dark' | 'system' | null
    const theme = stored ?? 'system'
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [])

  return <>{children}</>
}
