'use client'

import { useEffect, useState } from 'react'

/**
 * Detecta viewport móvil de forma SSR-safe.
 * Breakpoint por defecto: <768px (md de Tailwind) — el mismo umbral que usa
 * el Modal full-screen, así "móvil" significa lo mismo en toda la app.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [breakpoint])

  return isMobile
}
