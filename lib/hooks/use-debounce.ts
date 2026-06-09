'use client'

import { useEffect, useState } from 'react'

/**
 * Devuelve una versión "diferida" del valor que sólo se actualiza
 * cuando pasaron `delay` ms sin cambios. Útil para buscadores.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
