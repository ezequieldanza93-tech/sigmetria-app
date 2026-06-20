'use client'

/**
 * ProtocoloAdjuntosControl — control reusable para SUBIR / VER / ELIMINAR los
 * adjuntos manuales (encomienda / plano / otro) de un protocolo ejecutado.
 *
 * Estos adjuntos se fusionan al PDF de evidencia al emitir (lib/pdf/anexos-manuales.ts).
 * El archivo se lee en el cliente como dataURL (FileReader) y se manda al server action
 * subirAdjuntoProtocolo, que resuelve el tenant y sube al bucket privado `documentos`.
 *
 * Se pasa `tipos` con los tipos que se quieren ofrecer (ej. ['encomienda','plano']).
 * Por cada tipo que aún NO tenga adjunto se muestra un input file; los ya cargados
 * se listan con link "Ver" + botón eliminar.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAdjuntosProtocolo,
  subirAdjuntoProtocolo,
  eliminarAdjuntoProtocolo,
  type AdjuntoProtocoloItem,
  type TipoAdjuntoProtocolo,
} from '@/lib/actions/protocolo-adjuntos'
import { Upload, Trash2, FileText, Eye, Loader2 } from 'lucide-react'

interface ProtocoloAdjuntosControlProps {
  registroId: string
  rgFechaPlanificada: string
  /** Tipos de adjunto a ofrecer (uno o más). */
  tipos: TipoAdjuntoProtocolo[]
  /**
   * Callback opcional: se llama cada vez que cambia la lista de adjuntos (carga
   * inicial, subida, eliminación). Útil para que el padre muestre un aviso de
   * "qué falta" sincronizado con el control, sin re-fetchear.
   */
  onAdjuntosChange?: (adjuntos: AdjuntoProtocoloItem[]) => void
}

const TIPO_LABEL: Record<TipoAdjuntoProtocolo, string> = {
  encomienda: 'Encomienda del colegio profesional',
  plano: 'Plano o croquis',
  otro: 'Otro documento',
}

/** Lee un File como dataURL base64 (para mandarlo al server action). */
function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export function ProtocoloAdjuntosControl({
  registroId,
  rgFechaPlanificada,
  tipos,
  onAdjuntosChange,
}: ProtocoloAdjuntosControlProps) {
  const [adjuntos, setAdjuntos] = useState<AdjuntoProtocoloItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendoTipo, setSubiendoTipo] = useState<TipoAdjuntoProtocolo | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  // Ref al callback para no re-disparar efectos cuando el padre lo recrea en cada render.
  const onChangeRef = useRef(onAdjuntosChange)
  useEffect(() => {
    onChangeRef.current = onAdjuntosChange
  }, [onAdjuntosChange])

  const aplicar = useCallback((items: AdjuntoProtocoloItem[]) => {
    setAdjuntos(items)
    onChangeRef.current?.(items)
  }, [])

  const recargar = useCallback(async () => {
    setCargando(true)
    try {
      const items = await getAdjuntosProtocolo(registroId, rgFechaPlanificada)
      aplicar(items)
    } finally {
      setCargando(false)
    }
  }, [registroId, rgFechaPlanificada, aplicar])

  useEffect(() => {
    let activo = true
    ;(async () => {
      setCargando(true)
      try {
        const items = await getAdjuntosProtocolo(registroId, rgFechaPlanificada)
        if (activo) aplicar(items)
      } finally {
        if (activo) setCargando(false)
      }
    })()
    return () => {
      activo = false
    }
  }, [registroId, rgFechaPlanificada, aplicar])

  async function handleSubir(tipo: TipoAdjuntoProtocolo, file: File) {
    setError(null)
    setSubiendoTipo(tipo)
    try {
      const dataUrl = await leerComoDataUrl(file)
      const res = await subirAdjuntoProtocolo(registroId, rgFechaPlanificada, tipo, dataUrl, file.name)
      if (!res.success) {
        setError(res.error)
        return
      }
      await recargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el adjunto')
    } finally {
      setSubiendoTipo(null)
      const input = inputsRef.current[tipo]
      if (input) input.value = ''
    }
  }

  async function handleEliminar(id: string) {
    setError(null)
    setEliminandoId(id)
    try {
      const res = await eliminarAdjuntoProtocolo(id)
      if (!res.success) {
        setError(res.error)
        return
      }
      aplicar(adjuntos.filter(a => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el adjunto')
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        <FileText size={15} className="text-sig-500" /> Documentos adjuntos
      </h4>

      {error && (
        <div className="bg-danger-bg border border-red-200 text-danger text-xs rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Adjuntos ya cargados */}
      {cargando ? (
        <p className="text-xs text-text-tertiary flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Cargando adjuntos…
        </p>
      ) : adjuntos.length > 0 ? (
        <ul className="space-y-1.5">
          {adjuntos.map(a => (
            <li
              key={a.id}
              className="flex items-center gap-2 text-sm border border-border-subtle rounded-lg px-3 py-2 bg-surface-elevated/40"
            >
              <FileText size={14} className="text-text-tertiary shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-text-primary">
                  {TIPO_LABEL[a.tipo as TipoAdjuntoProtocolo] ?? a.tipo}
                </span>
                <span className="text-text-tertiary"> · {a.nombre}</span>
              </span>
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sig-600 hover:text-sig-700 font-medium shrink-0"
                >
                  <Eye size={13} /> Ver
                </a>
              )}
              <button
                type="button"
                onClick={() => handleEliminar(a.id)}
                disabled={eliminandoId === a.id}
                className="inline-flex items-center text-text-tertiary hover:text-danger disabled:opacity-50 shrink-0"
                aria-label="Eliminar adjunto"
              >
                {eliminandoId === a.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-tertiary">Todavía no hay documentos adjuntos.</p>
      )}

      {/* Inputs por cada tipo que falta */}
      <div className="space-y-2">
        {tipos.map(tipo => {
          const yaTiene = adjuntos.some(a => a.tipo === tipo)
          if (yaTiene) return null
          const subiendo = subiendoTipo === tipo
          return (
            <label
              key={tipo}
              className={`flex items-center gap-2 text-sm border border-dashed border-border-default rounded-lg px-3 py-2 cursor-pointer hover:bg-surface-elevated/40 transition-colors ${
                subiendo ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {subiendo ? (
                <Loader2 size={14} className="animate-spin text-sig-500 shrink-0" />
              ) : (
                <Upload size={14} className="text-sig-500 shrink-0" />
              )}
              <span className="text-text-secondary">
                {subiendo ? 'Subiendo…' : `Subir ${TIPO_LABEL[tipo].toLowerCase()}`}
              </span>
              <input
                ref={el => {
                  inputsRef.current[tipo] = el
                }}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                disabled={subiendo}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void handleSubir(tipo, file)
                }}
              />
            </label>
          )
        })}
      </div>
    </div>
  )
}
