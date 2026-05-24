'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RotateCcw, Building2 } from 'lucide-react'

interface CachedSession {
  consultoraNombre?: string
  empresaNombre?: string
}

export default function OfflinePage() {
  const [cached, setCached] = useState<CachedSession | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.offline-session')
    if (stored) {
      try {
        setCached(JSON.parse(stored) as CachedSession)
      } catch {
        /* ignore */
      }
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-base p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <WifiOff size={32} className="text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <h1 className="text-2xl font-heading font-bold text-text-primary">
          Te quedaste sin conexión
        </h1>

        <p className="text-text-secondary text-sm leading-relaxed">
          No se puede cargar esta página porque no hay conexión a internet.
          Revisá tu conexión y volvé a intentarlo.
        </p>

        {cached?.consultoraNombre && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary">
            <Building2 size={16} strokeWidth={1.75} />
            <span>{cached.consultoraNombre}</span>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-primary text-white font-medium text-sm hover:bg-brand-primary/90 transition-colors"
        >
          <RotateCcw size={16} strokeWidth={2} />
          Reintentar
        </button>

        {cached?.empresaNombre && (
          <p className="text-xs text-text-tertiary">
            Última consultora visitada: {cached.empresaNombre}
          </p>
        )}
      </div>
    </div>
  )
}
