'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-danger-bg flex items-center justify-center shrink-0">
            <span className="text-danger text-lg font-bold">!</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Error en el dashboard</h2>
            <p className="text-sm text-text-secondary">Copiá el detalle de abajo y reportalo</p>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-danger-bg p-4 space-y-2">
          <p className="text-xs font-bold text-danger uppercase tracking-wide">Mensaje</p>
          <p className="text-sm text-red-800 font-mono break-all">{error.message || 'Error desconocido'}</p>
        </div>

        {error.digest && (
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-1">Digest</p>
            <p className="text-sm font-mono text-text-secondary">{error.digest}</p>
          </div>
        )}

        {error.stack && (
          <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wide mb-2">Stack trace</p>
            <pre className="text-xs font-mono text-text-secondary overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="text-sm font-medium text-white bg-success hover:bg-green-700 rounded-lg px-4 py-2 transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="text-sm font-medium text-text-secondary bg-surface-elevated hover:bg-surface-sunken rounded-lg px-4 py-2 transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
