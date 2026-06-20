'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getActividadesCiiu,
  getActividadesDeNorma,
  type ActividadCiiu,
} from '@/lib/actions/normativa-actividades'
import { NormativaActividadesModal } from './normativa-actividades-modal'

interface Props {
  normaId: string
  /** true cuando el usuario puede editar las actividades de esta norma. */
  puedeEditar?: boolean
}

/**
 * Sección "Actividades (CIIU)" dentro del detalle de una norma.
 *
 * SEMÁNTICA: sin actividades asignadas → la norma aplica a TODAS. Con actividades
 * asignadas → solo a esas. (Espeja normativa_normas_actividades; no hay flag.)
 */
export function NormativaActividades({ normaId, puedeEditar = false }: Props) {
  // IDs asignados a la norma + catálogo (para mostrar código/nombre).
  const [asignadas, setAsignadas] = useState<string[] | null>(null)
  const [catalogo, setCatalogo] = useState<ActividadCiiu[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setErrorMsg(null)
    Promise.all([getActividadesDeNorma(normaId), getActividadesCiiu()])
      .then(([resAsignadas, resCatalogo]) => {
        if (cancelado) return
        if (!resAsignadas.success) {
          setErrorMsg(resAsignadas.error)
          return
        }
        if (!resCatalogo.success) {
          setErrorMsg(resCatalogo.error)
          return
        }
        setAsignadas(resAsignadas.data)
        setCatalogo(resCatalogo.data)
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
  }, [normaId])

  function handleSaved(nuevos: string[]) {
    setAsignadas(nuevos)
  }

  if (loading) {
    return (
      <div className="mt-4 border-t border-border-subtle pt-4">
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Cargando actividades…
        </div>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="mt-4 border-t border-border-subtle pt-4">
        <p className="text-sm text-danger">{errorMsg}</p>
      </div>
    )
  }

  const ids = new Set(asignadas ?? [])
  const seleccionadas = catalogo.filter((a) => ids.has(a.id))
  const aplicaATodas = seleccionadas.length === 0

  return (
    <div className="mt-4 border-t border-border-subtle pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
          Actividades (CIIU)
        </p>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Editar actividades
          </button>
        )}
      </div>

      {aplicaATodas ? (
        <p className="text-sm text-text-secondary">Aplica a todas las actividades</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {seleccionadas.map((a) => (
            <span
              key={a.id}
              title={a.nombre}
              className={cn(
                'inline-flex items-center gap-1 max-w-full rounded-full px-2 py-0.5 text-[11px] font-medium',
                'bg-[var(--info-bg)] text-[var(--info)]',
              )}
            >
              <span className="font-mono text-[10px] opacity-80">{a.codigo}</span>
              <span className="truncate">{a.nombre}</span>
            </span>
          ))}
        </div>
      )}

      {puedeEditar && (
        <NormativaActividadesModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          normaId={normaId}
          asignadasInicial={asignadas ?? []}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
