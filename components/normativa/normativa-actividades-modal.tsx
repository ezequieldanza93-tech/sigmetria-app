'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CIIU_SECCIONES } from '@/lib/constants'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import {
  getActividadesCiiu,
  setActividadesNorma,
  type ActividadCiiu,
} from '@/lib/actions/normativa-actividades'

interface Props {
  open: boolean
  onClose: () => void
  /** Norma cuyas actividades se editan. */
  normaId: string
  /** IDs actualmente asignados (para precargar). */
  asignadasInicial: string[]
  /** Se llama con el nuevo set de IDs guardado. */
  onSaved: (actividadIds: string[]) => void
}

interface SeccionGrupo {
  seccion: string
  actividades: ActividadCiiu[]
}

/** Agrupa actividades por sección (letra A–U), preservando el orden por código. */
function agruparPorSeccion(actividades: ActividadCiiu[]): SeccionGrupo[] {
  const grupos: SeccionGrupo[] = []
  const indice = new Map<string, SeccionGrupo>()
  for (const act of actividades) {
    const seccion = act.seccion ?? 'Sin sección'
    let grupo = indice.get(seccion)
    if (!grupo) {
      grupo = { seccion, actividades: [] }
      indice.set(seccion, grupo)
      grupos.push(grupo)
    }
    grupo.actividades.push(act)
  }
  return grupos
}

export function NormativaActividadesModal({
  open,
  onClose,
  normaId,
  asignadasInicial,
  onSaved,
}: Props) {
  const { success, error } = useToast()
  const [actividades, setActividades] = useState<ActividadCiiu[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Set de IDs seleccionados (estado de edición).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  // Secciones colapsadas (por letra). Por defecto todas expandidas.
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())

  // Carga del catálogo + precarga de selección cada vez que se abre.
  useEffect(() => {
    if (!open) return
    let cancelado = false
    setLoading(true)
    setErrorMsg(null)
    setSeleccion(new Set(asignadasInicial))
    setColapsadas(new Set())
    getActividadesCiiu()
      .then((res) => {
        if (cancelado) return
        if (res.success) setActividades(res.data)
        else setErrorMsg(res.error)
      })
      .catch(() => {
        if (!cancelado) setErrorMsg('No se pudieron cargar las actividades')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [open, asignadasInicial])

  const grupos = actividades ? agruparPorSeccion(actividades) : []

  function toggleUna(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSeccion(grupo: SeccionGrupo) {
    const ids = grupo.actividades.map((a) => a.id)
    const todasTildadas = ids.every((id) => seleccion.has(id))
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (todasTildadas) {
        for (const id of ids) next.delete(id)
      } else {
        for (const id of ids) next.add(id)
      }
      return next
    })
  }

  function toggleColapso(seccion: string) {
    setColapsadas((prev) => {
      const next = new Set(prev)
      if (next.has(seccion)) next.delete(seccion)
      else next.add(seccion)
      return next
    })
  }

  function limpiarTodo() {
    setSeleccion(new Set())
  }

  async function handleGuardar() {
    setSaving(true)
    const ids = [...seleccion]
    const res = await setActividadesNorma(normaId, ids)
    setSaving(false)
    if (res.success) {
      success('Actividades actualizadas')
      onSaved(ids)
      onClose()
    } else {
      error(res.error)
    }
  }

  const totalSeleccionadas = seleccion.size

  return (
    <Modal open={open} onClose={onClose} title="Actividades (CIIU)" size="full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text-secondary">
            {totalSeleccionadas === 0
              ? 'Sin actividades seleccionadas → la norma aplica a todas.'
              : `${totalSeleccionadas} ${totalSeleccionadas === 1 ? 'actividad seleccionada' : 'actividades seleccionadas'}.`}
          </p>
          {totalSeleccionadas > 0 && (
            <button
              type="button"
              onClick={limpiarTodo}
              className="text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              Limpiar selección
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-tertiary py-8 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Cargando actividades…
          </div>
        ) : errorMsg ? (
          <p className="text-sm text-danger py-4">{errorMsg}</p>
        ) : grupos.length === 0 ? (
          <p className="text-sm text-text-tertiary py-4">No hay actividades cargadas en el catálogo.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border-subtle divide-y divide-border-subtle">
            {grupos.map((grupo) => {
              const ids = grupo.actividades.map((a) => a.id)
              const tildadas = ids.filter((id) => seleccion.has(id)).length
              const todasTildadas = tildadas === ids.length
              const algunasTildadas = tildadas > 0 && !todasTildadas
              const colapsada = colapsadas.has(grupo.seccion)

              return (
                <div key={grupo.seccion}>
                  {/* Encabezado de sección: tilda toda la sección + colapsa/expande */}
                  <div className="flex items-center gap-2 bg-surface-sunken/50 px-3 py-2">
                    <Checkbox
                      checked={todasTildadas}
                      partial={algunasTildadas}
                      onChange={() => toggleSeccion(grupo)}
                      ariaLabel={`Seleccionar toda la sección ${grupo.seccion}`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleColapso(grupo.seccion)}
                      className="flex flex-1 items-center justify-between gap-2 min-w-0 text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded bg-brand-primary/10 text-[11px] font-bold text-brand-primary">
                          {grupo.seccion}
                        </span>
                        <span className="text-xs font-semibold text-text-primary truncate">
                          {CIIU_SECCIONES[grupo.seccion] ?? `Sección ${grupo.seccion}`}
                        </span>
                        <span className="shrink-0 text-[10px] text-text-tertiary">
                          {tildadas}/{ids.length}
                        </span>
                      </span>
                      {colapsada ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
                      ) : (
                        <ChevronUp className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {/* Divisiones de la sección */}
                  {!colapsada && (
                    <ul>
                      {grupo.actividades.map((act) => {
                        const isOn = seleccion.has(act.id)
                        return (
                          <li key={act.id}>
                            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 pl-8 text-xs text-text-primary hover:bg-surface-sunken transition-colors">
                              <Checkbox
                                checked={isOn}
                                onChange={() => toggleUna(act.id)}
                                ariaLabel={`${act.codigo} ${act.nombre}`}
                              />
                              <span className="shrink-0 font-mono text-[11px] text-text-tertiary">
                                {act.codigo}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{act.nombre}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGuardar} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar actividades'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
// Checkbox custom — mismo patrón visual que multi-select-filter.tsx
// (appearance-none + Check de lucide). Soporta estado "parcial".
// ============================================================

function Checkbox({
  checked,
  partial = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  partial?: boolean
  onChange: () => void
  ariaLabel: string
}) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'peer h-4 w-4 cursor-pointer appearance-none rounded border border-border-default',
          (checked || partial) && 'border-brand-primary bg-brand-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30',
        )}
      />
      {checked && (
        <Check className="pointer-events-none absolute h-3 w-3 text-white" aria-hidden="true" />
      )}
      {partial && !checked && (
        <span className="pointer-events-none absolute h-0.5 w-2 rounded-full bg-white" />
      )}
    </span>
  )
}
