'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { setDocumentoVisiblePublico } from '@/lib/actions/verificacion'
import type { Documento } from '@/lib/types'

interface LegajoPublicoVisibilidadProps {
  /** Documentos del legajo técnico del establecimiento (nivel establecimiento). */
  documentos: Documento[]
  establecimientoId: string
  empresaId: string
  canWrite?: boolean
}

interface Row {
  id: string
  nombre: string
  fechaVencimiento: string | null
  visible: boolean
}

/**
 * Control de VISIBILIDAD por documento en la vista pública del QR (2C.1/2C.2).
 * El profesional decide qué documentos del legajo ve el inspector. El filtro de
 * VENCIDOS es automático en la vista pública (acá se marca "vencido" como ayuda,
 * pero ocultar/mostrar es independiente). Trabaja sobre establecimientos_documentos
 * (la única tabla con la columna legajo_publico_visible).
 */
export function LegajoPublicoVisibilidad({
  documentos, establecimientoId, empresaId, canWrite = false,
}: LegajoPublicoVisibilidadProps) {
  // Dedupe por tipo quedándonos con el más nuevo (igual criterio que la vista pública).
  const ultimoPorTipo = new Map<string, Documento>()
  for (const d of documentos) {
    const key = d.tipo_id ?? `__sin_tipo__${d.id}`
    const prev = ultimoPorTipo.get(key)
    if (!prev || new Date(d.created_at).getTime() > new Date(prev.created_at).getTime()) {
      ultimoPorTipo.set(key, d)
    }
  }
  const inicial: Row[] = Array.from(ultimoPorTipo.values()).map(d => ({
    id: d.id,
    nombre: d.documentos_tipos?.nombre ?? 'Documento',
    fechaVencimiento: d.fecha_vencimiento,
    visible: d.legajo_publico_visible ?? true,
  }))

  const [rows, setRows] = useState<Row[]>(inicial)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const ahora = Date.now()
  const esVencido = (fecha: string | null) => fecha !== null && new Date(fecha).getTime() < ahora

  const toggle = (row: Row) => {
    const nuevoVisible = !row.visible
    setSavingId(row.id)
    setError(null)
    // Optimista.
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, visible: nuevoVisible } : r))
    startTransition(async () => {
      const res = await setDocumentoVisiblePublico(row.id, establecimientoId, empresaId, nuevoVisible)
      setSavingId(null)
      if (!res.success) {
        // Revertir si falló.
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, visible: !nuevoVisible } : r))
        setError(res.error ?? 'No se pudo cambiar la visibilidad')
      }
    })
  }

  if (rows.length === 0) return null

  return (
    <div className="bg-surface-base dark:bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border-subtle bg-surface-base dark:bg-surface-sunken">
        <Lock size={14} className="text-text-tertiary" />
        <h4 className="text-sm font-semibold text-text-primary dark:text-white">
          Visibilidad en el QR público
        </h4>
        <span className="text-xs text-text-tertiary dark:text-white bg-surface-elevated dark:bg-surface-base rounded-full px-2 py-0.5">
          {rows.filter(r => r.visible).length}/{rows.length}
        </span>
      </div>
      <div className="px-5 py-3 space-y-1">
        <p className="text-xs text-text-secondary mb-2">
          Elegí qué documentos del legajo puede ver y abrir el inspector al escanear el QR.
          Los documentos vencidos se ocultan automáticamente.
        </p>
        {error && <p className="text-xs text-danger mb-2">{error}</p>}
        <ul className="divide-y divide-border-subtle">
          {rows.map(row => {
            const vencido = esVencido(row.fechaVencimiento)
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{row.nombre}</p>
                  <p className="text-xs text-text-tertiary">
                    {row.fechaVencimiento ? formatDate(row.fechaVencimiento) : 'Sin vencimiento'}
                    {vencido && <span className="text-danger"> · vencido (oculto en el QR)</span>}
                  </p>
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => toggle(row)}
                    disabled={isPending && savingId === row.id}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      row.visible
                        ? 'border border-success/30 text-success hover:bg-success/10'
                        : 'border border-border-subtle text-text-tertiary hover:bg-surface-base'
                    }`}
                    title={row.visible ? 'Visible para el inspector — clic para ocultar' : 'Oculto — clic para mostrar'}
                  >
                    {row.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    {row.visible ? 'Visible' : 'Oculto'}
                  </button>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-xs text-text-tertiary">
                    {row.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    {row.visible ? 'Visible' : 'Oculto'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
