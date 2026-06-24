'use client'

import { useEffect, useState } from 'react'
import { WifiOff, RotateCcw, Building2, FileCheck, ChevronLeft } from 'lucide-react'
import { listLegajoSnapshots } from '@/lib/offline/legajo-cache'
import { LegajoOfflineViewer } from '@/components/offline/legajo-offline-viewer'
import type { LegajoSnapshot } from '@/lib/offline/types'
import { formatDate } from '@/lib/utils'

interface CachedSession {
  consultoraNombre?: string
  empresaNombre?: string
}

export default function OfflinePage() {
  const [cached, setCached] = useState<CachedSession | null>(null)
  const [snapshots, setSnapshots] = useState<LegajoSnapshot[] | null>(null)
  const [selected, setSelected] = useState<LegajoSnapshot | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sigmetria.offline-session')
    if (stored) {
      try {
        setCached(JSON.parse(stored) as CachedSession)
      } catch {
        /* ignore */
      }
    }
    listLegajoSnapshots()
      .then((list) => setSnapshots(list.sort((a, b) => b.savedAt.localeCompare(a.savedAt))))
      .catch(() => setSnapshots([]))
  }, [])

  // Vista de un legajo cacheado seleccionado (solo lectura, sin señal).
  if (selected) {
    return (
      <div className="min-h-screen bg-surface-base">
        <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface-base/95 backdrop-blur px-4 py-3 dark:bg-surface-elevated/95">
          <button
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sig-600 hover:text-sig-700"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Volver a legajos offline
          </button>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-5">
          <LegajoOfflineViewer snapshot={selected} />
        </div>
      </div>
    )
  }

  const tieneLegajos = snapshots !== null && snapshots.length > 0

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center bg-surface-base p-6">
      <div className="max-w-md w-full space-y-6 py-8">
        <div className="text-center space-y-4">
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
            {tieneLegajos
              ? ' Mientras tanto, podés consultar los legajos que tenés guardados sin conexión.'
              : ' Revisá tu conexión y volvé a intentarlo.'}
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
        </div>

        {/* Legajos disponibles offline. */}
        {tieneLegajos && (
          <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 text-left dark:bg-surface-base">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              <FileCheck size={14} aria-hidden="true" />
              Legajos disponibles sin conexión
            </p>
            <ul className="divide-y divide-border-subtle">
              {snapshots!.map((snap) => (
                <li key={snap.establecimientoId}>
                  <button
                    onClick={() => setSelected(snap)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary dark:text-white">
                        {snap.establecimiento.nombre}
                      </p>
                      <p className="truncate text-xs text-text-tertiary">
                        {snap.establecimiento.empresaRazonSocial ?? 'Guardado'} · {formatDate(snap.savedAt)}
                      </p>
                    </div>
                    <ChevronLeft size={16} className="shrink-0 rotate-180 text-text-tertiary" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cached?.empresaNombre && !tieneLegajos && (
          <p className="text-center text-xs text-text-tertiary">
            Última consultora visitada: {cached.empresaNombre}
          </p>
        )}
      </div>
    </div>
  )
}
