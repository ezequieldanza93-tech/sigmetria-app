'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  getRequisitosByNorma,
  type NormativaRequisito,
} from '@/lib/actions/normativa-legal'

const CLAMP_CHARS = 280

function RequisitoItem({ req }: { req: NormativaRequisito }) {
  const [open, setOpen] = useState(false)
  const oficial = req.descripcion_oficial?.trim() ?? ''
  const esLargo = oficial.length > CLAMP_CHARS
  const visible = open || !esLargo ? oficial : `${oficial.slice(0, CLAMP_CHARS).trimEnd()}…`

  return (
    <li className="relative pl-4 border-l-2 border-border-subtle">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
        {req.articulo && (
          <span className="text-sm font-semibold text-brand-primary">{req.articulo}</span>
        )}
        {req.descripcion_corta && (
          <span className="text-sm font-medium text-text-primary">{req.descripcion_corta}</span>
        )}
        {req.code && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-sunken text-text-tertiary">
            {req.code}
          </span>
        )}
      </div>
      {oficial && (
        <div>
          <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{visible}</p>
          {esLargo && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 text-xs font-medium text-brand-primary hover:underline"
            >
              {open ? 'Ver menos' : 'Ver texto completo'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

export function NormativaRequisitos({ normaId }: { normaId: string }) {
  const [requisitos, setRequisitos] = useState<NormativaRequisito[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError(null)
    getRequisitosByNorma(normaId)
      .then((res) => {
        if (cancelado) return
        if (res.success) setRequisitos(res.data)
        else setError(res.error)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los requisitos')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [normaId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-tertiary py-3">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando requisitos…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-danger py-3">{error}</p>
  }

  if (!requisitos || requisitos.length === 0) {
    return <p className="text-sm text-text-tertiary py-3">Esta norma no tiene requisitos cargados.</p>
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary mb-3">
        Requisitos ({requisitos.length})
      </p>
      <ul className="flex flex-col gap-4">
        {requisitos.map((r) => (
          <RequisitoItem key={r.id} req={r} />
        ))}
      </ul>
    </div>
  )
}
