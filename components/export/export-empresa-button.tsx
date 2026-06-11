'use client'

import { useState } from 'react'
import { Download, Package, Loader2, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { Modal } from '@/components/ui/modal'

interface Props {
  empresaId: string
}

type Formato = 'both' | 'csv' | 'json'
type Alcance = 'completo' | 'parcial'

/**
 * Botón + panel "Exportar mis datos" (Res. SRT 48/2025 — portabilidad).
 *
 * Permite elegir alcance (completo/parcial), rango de fechas, formato e incluir
 * archivos. Para paquetes grandes el backend responde un signed URL (modo async)
 * que abrimos en una nueva pestaña; si es descarga directa, bajamos el blob.
 * Solo se renderiza para quien tiene permiso sobre la empresa (lo decide el caller).
 */
export function ExportEmpresaButton({ empresaId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { error, success } = useToast()

  // Opciones de alcance.
  const [alcance, setAlcance] = useState<Alcance>('completo')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [formato, setFormato] = useState<Formato>('both')
  const [incluirArchivos, setIncluirArchivos] = useState(true)

  function buildUrl(): string {
    const qs = new URLSearchParams()
    if (alcance === 'parcial') {
      if (desde) qs.set('desde', desde)
      if (hasta) qs.set('hasta', hasta)
    }
    if (formato !== 'both') qs.set('formato', formato)
    if (!incluirArchivos) qs.set('archivos', '0')
    const query = qs.toString()
    return `/api/export/empresa/${empresaId}${query ? `?${query}` : ''}`
  }

  async function handleExport() {
    setLoading(true)
    setDone(false)
    try {
      const res = await fetch(buildUrl())
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Error ${res.status}`)
      }

      const contentType = res.headers.get('Content-Type') ?? ''

      // Modo async: el backend devuelve JSON con un signed URL temporal.
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { signedUrl?: string }
        if (json.signedUrl) {
          window.open(json.signedUrl, '_blank', 'noopener,noreferrer')
          success('Tu exportación está lista. Te enviamos también el enlace por email.')
          setDone(true)
          return
        }
        throw new Error('Respuesta inesperada del servidor')
      }

      // Modo síncrono: descarga directa del ZIP.
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.href = url
      a.download = match?.[1] ?? 'sigmetria_export.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDone(true)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al exportar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setDone(false)
          setOpen(true)
        }}
        className="inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Download className="size-3.5" />
        Exportar datos
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Exportar mis datos">
        <div className="space-y-5">
          <p className="text-sm text-text-tertiary">
            Descargá los datos de esta empresa en formato de lectura mecánica (CSV y JSON),
            con los archivos originales y un manifiesto con verificación de integridad.
          </p>

          {/* Alcance */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Alcance</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAlcance('completo')}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  alcance === 'completo'
                    ? 'border-brand-primary bg-brand-primary/10 text-text-primary'
                    : 'border-border-default text-text-tertiary hover:bg-surface-elevated'
                }`}
              >
                Completo
              </button>
              <button
                type="button"
                onClick={() => setAlcance('parcial')}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  alcance === 'parcial'
                    ? 'border-brand-primary bg-brand-primary/10 text-text-primary'
                    : 'border-border-default text-text-tertiary hover:bg-surface-elevated'
                }`}
              >
                Por rango de fechas
              </button>
            </div>
          </div>

          {/* Rango de fechas (solo parcial) */}
          {alcance === 'parcial' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-text-tertiary">Desde</span>
                <input
                  type="date"
                  value={desde}
                  onChange={e => setDesde(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-text-tertiary">Hasta</span>
                <input
                  type="date"
                  value={hasta}
                  onChange={e => setHasta(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </label>
            </div>
          )}

          {/* Formato */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Formato</span>
            <div className="grid grid-cols-3 gap-2">
              {(['both', 'csv', 'json'] as Formato[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormato(f)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    formato === f
                      ? 'border-brand-primary bg-brand-primary/10 text-text-primary'
                      : 'border-border-default text-text-tertiary hover:bg-surface-elevated'
                  }`}
                >
                  {f === 'both' ? 'CSV + JSON' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Incluir archivos */}
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={incluirArchivos}
              onChange={e => setIncluirArchivos(e.target.checked)}
              className="size-4 rounded border-border-default"
            />
            <Package className="size-4 text-text-tertiary" />
            Incluir archivos originales (fotos, documentos)
          </label>

          {/* Acción */}
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-primary text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generando…
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="size-4" /> Listo — generar otra
              </>
            ) : (
              <>
                <Download className="size-4" /> Generar exportación
              </>
            )}
          </button>

          <p className="text-xs text-text-tertiary">
            Para paquetes grandes, generamos el archivo en segundo plano y te enviamos un
            enlace de descarga temporal por email.
          </p>
        </div>
      </Modal>
    </>
  )
}
