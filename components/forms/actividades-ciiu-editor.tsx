'use client'

import { useState } from 'react'
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { CIIU_SECCIONES } from '@/lib/constants'
import {
  useActividadesCiiu,
  useActividadesDeDocumentoTipo,
  useSetActividadesDocumentoTipo,
} from '@/lib/queries/documentos-actividades'
import type { ActividadCiiuItem } from '@/lib/actions/documentos-actividades'

interface ActividadesCiiuEditorProps {
  docTipoId: string
  /** Solo quien gestiona librerías puede editar; en lectura se ven los chips deshabilitados. */
  canEdit: boolean
  /** El editor solo trae datos cuando la fila está expandida (lazy). */
  enabled: boolean
}

/** Agrupa el catálogo CIIU por sección (letra A–U), preservando el orden por código. */
function agruparPorSeccion(actividades: ActividadCiiuItem[]) {
  const grupos: { seccion: string; items: ActividadCiiuItem[] }[] = []
  const idx = new Map<string, number>()
  for (const act of actividades) {
    const key = act.seccion ?? '—'
    let pos = idx.get(key)
    if (pos === undefined) {
      pos = grupos.length
      idx.set(key, pos)
      grupos.push({ seccion: key, items: [] })
    }
    grupos[pos].items.push(act)
  }
  return grupos
}

export function ActividadesCiiuEditor({ docTipoId, canEdit, enabled }: ActividadesCiiuEditorProps) {
  const [abierto, setAbierto] = useState(false)
  const activar = enabled && abierto

  const { data: catalogo, isLoading: cargandoCatalogo } = useActividadesCiiu()
  const { data: asignadas, isLoading: cargandoAsignadas } = useActividadesDeDocumentoTipo(
    docTipoId,
    activar,
  )
  const setMutation = useSetActividadesDocumentoTipo()

  // Borrador local: se inicializa desde el servidor cuando llega y se edita en cliente.
  const [seleccion, setSeleccion] = useState<string[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cuando llegan las asignadas y aún no hay borrador local, lo sembramos.
  if (asignadas && seleccion === null) {
    setSeleccion(asignadas)
  }

  const actividades = catalogo ?? []
  const grupos = agruparPorSeccion(actividades)
  const seleccionados = seleccion ?? []
  const seleccionadosSet = new Set(seleccionados)
  const cargando = cargandoCatalogo || cargandoAsignadas
  const guardando = setMutation.isPending
  const controlesDeshabilitados = guardando || !canEdit

  function toggleActividad(id: string) {
    setSeleccion((prev) => {
      const base = prev ?? []
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })
  }

  function toggleSeccion(items: ActividadCiiuItem[]) {
    const idsSeccion = items.map((i) => i.id)
    const todosSeleccionados = idsSeccion.every((id) => seleccionadosSet.has(id))
    setSeleccion((prev) => {
      const base = prev ?? []
      if (todosSeleccionados) {
        // Deseleccionar toda la sección.
        const quitar = new Set(idsSeccion)
        return base.filter((id) => !quitar.has(id))
      }
      // Seleccionar toda la sección (sin duplicar).
      return Array.from(new Set([...base, ...idsSeccion]))
    })
  }

  async function handleGuardar() {
    setError(null)
    setSaved(false)
    try {
      await new Promise<void>((res, rej) =>
        setMutation.mutate(
          { docTipoId, actividadIds: seleccionados },
          { onSuccess: () => res(), onError: (e) => rej(e) },
        ),
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    }
  }

  return (
    <div className="md:col-span-2 flex flex-col gap-2 border-t border-border-subtle pt-4">
      {/* ── Cabecera plegable ── */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 text-left group"
      >
        {abierto ? (
          <ChevronDown size={16} className="text-brand-primary shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-text-tertiary shrink-0 group-hover:text-text-secondary" />
        )}
        <Briefcase size={14} className="text-text-tertiary shrink-0" />
        <span className="text-sm font-medium text-text-secondary">Actividades (CIIU)</span>
        {/* Resumen cuando está colapsado */}
        {!abierto && seleccion !== null && (
          <span className="text-xs text-text-tertiary">
            {seleccionados.length === 0
              ? '· Se espera para todas las actividades'
              : `· ${seleccionados.length} actividad${seleccionados.length !== 1 ? 'es' : ''}`}
          </span>
        )}
      </button>

      {abierto && (
        <div className="flex flex-col gap-3 pl-6">
          <p className="text-xs text-text-tertiary flex items-center gap-1">
            <Info size={12} className="shrink-0" />
            Sin actividades seleccionadas, este documento se espera para todas las actividades.
          </p>

          {cargando ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-8 bg-surface-elevated rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {grupos.map((grupo) => {
                const idsSeccion = grupo.items.map((i) => i.id)
                const todosSeleccionados = idsSeccion.every((id) => seleccionadosSet.has(id))
                const algunoSeleccionado = idsSeccion.some((id) => seleccionadosSet.has(id))
                return (
                  <div key={grupo.seccion} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSeccion(grupo.items)}
                        disabled={controlesDeshabilitados}
                        className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          todosSeleccionados
                            ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
                            : 'bg-surface-sunken text-text-secondary border-border-default hover:border-brand-primary hover:text-brand-primary'
                        }`}
                      >
                        {todosSeleccionados ? <Check size={11} /> : null}
                        {grupo.seccion} · {CIIU_SECCIONES[grupo.seccion] ?? 'Sección'}
                      </button>
                      <span className="text-[11px] text-text-tertiary">
                        {algunoSeleccionado && !todosSeleccionados
                          ? `${idsSeccion.filter((id) => seleccionadosSet.has(id)).length}/${idsSeccion.length}`
                          : `${idsSeccion.length} división${idsSeccion.length !== 1 ? 'es' : ''}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {grupo.items.map((act) => {
                        const selected = seleccionadosSet.has(act.id)
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => toggleActividad(act.id)}
                            disabled={controlesDeshabilitados}
                            title={`${act.codigo} — ${act.nombre}`}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed max-w-full ${
                              selected
                                ? 'bg-brand-primary text-white border-brand-primary'
                                : 'bg-surface-base text-text-secondary border-border-default hover:border-brand-primary hover:text-brand-primary'
                            }`}
                          >
                            {selected && <Check size={11} className="shrink-0" />}
                            <span className="truncate">
                              {act.codigo} — {act.nombre}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {seleccionados.length === 0 && (
                <p className="text-xs text-text-tertiary flex items-center gap-1">
                  <Info size={12} className="shrink-0" />
                  Se espera para todas las actividades
                </p>
              )}
            </div>
          )}

          {/* ── Acciones ── */}
          {!cargando && canEdit && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleGuardar}
                disabled={controlesDeshabilitados}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardando ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : saved ? (
                  <Check size={14} />
                ) : null}
                {saved ? 'Guardado' : 'Guardar actividades'}
              </button>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-danger">
                  <AlertTriangle size={12} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
