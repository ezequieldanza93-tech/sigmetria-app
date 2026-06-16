'use client'

import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteRequisito,
  getRequisitosByNorma,
  type NormativaRequisito,
} from '@/lib/actions/normativa-legal'
import { useToast } from '@/lib/hooks/use-toast'
import { NormativaRequisitoFormModal } from './normativa-requisito-form-modal'

const CLAMP_CHARS = 280

/**
 * Parsea markdown mínimo de negritas (`**texto**`) sin usar dangerouslySetInnerHTML.
 * Parte el string por `**` y alterna texto normal / <strong>.
 * Un `**` sin cerrar deja el tramo restante como texto normal.
 */
function renderNegritas(texto: string): React.ReactNode[] {
  return texto.split('**').map((tramo, i) =>
    // Los índices impares quedan entre pares de `**` → van en negrita.
    i % 2 === 1 ? <strong key={i}>{tramo}</strong> : <span key={i}>{tramo}</span>,
  )
}

function RequisitoItem({
  req,
  puedeEditar,
  onEdit,
  onDelete,
}: {
  req: NormativaRequisito
  puedeEditar: boolean
  onEdit: (req: NormativaRequisito) => void
  onDelete: (req: NormativaRequisito) => void
}) {
  const [open, setOpen] = useState(false)
  const oficial = req.descripcion_oficial?.trim() ?? ''
  const esLargo = oficial.length > CLAMP_CHARS
  const visible = open || !esLargo ? oficial : `${oficial.slice(0, CLAMP_CHARS).trimEnd()}…`

  return (
    <li className="relative pl-4 border-l-2 border-border-subtle">
      <div className="flex items-start gap-1 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
            {req.articulo && (
              <span className="text-sm font-semibold text-brand-primary">{req.articulo}</span>
            )}
            {req.descripcion_corta && (
              <span className="text-sm font-medium text-text-primary">
                {renderNegritas(req.descripcion_corta)}
              </span>
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
        </div>

        {puedeEditar && (
          <div className="flex shrink-0 items-center gap-0.5 ml-2">
            <button
              type="button"
              onClick={() => onEdit(req)}
              title="Editar requisito"
              aria-label={`Editar requisito ${req.articulo ?? ''}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(req)}
              title="Eliminar requisito"
              aria-label={`Eliminar requisito ${req.articulo ?? ''}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-text-tertiary hover:text-danger hover:bg-surface-elevated transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

interface NormativaRequisitosProps {
  normaId: string
  /** true cuando el usuario puede editar/crear/borrar requisitos de esta norma. */
  puedeEditar?: boolean
}

export function NormativaRequisitos({ normaId, puedeEditar = false }: NormativaRequisitosProps) {
  const { success, error } = useToast()
  const [requisitos, setRequisitos] = useState<NormativaRequisito[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modal de create/edit
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<NormativaRequisito | null>(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setErrorMsg(null)
    getRequisitosByNorma(normaId)
      .then((res) => {
        if (cancelado) return
        if (res.success) setRequisitos(res.data)
        else setErrorMsg(res.error)
      })
      .catch(() => {
        if (!cancelado) setErrorMsg('No se pudieron cargar los requisitos')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => { cancelado = true }
  }, [normaId])

  function abrirCrear() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function abrirEditar(req: NormativaRequisito) {
    setEditTarget(req)
    setModalOpen(true)
  }

  async function handleDelete(req: NormativaRequisito) {
    const label = req.articulo ?? req.descripcion_corta ?? 'este requisito'
    if (!confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`)) return
    const res = await deleteRequisito(req.id)
    if (res.success) {
      success('Requisito eliminado')
      setRequisitos((prev) => prev?.filter((r) => r.id !== req.id) ?? null)
    } else {
      error(res.error)
    }
  }

  function handleSaved(guardado: NormativaRequisito) {
    setRequisitos((prev) => {
      if (!prev) return [guardado]
      const idx = prev.findIndex((r) => r.id === guardado.id)
      if (idx >= 0) {
        // update
        const next = [...prev]
        next[idx] = guardado
        return next
      }
      // create: lo agregamos al final (el orden se ve reflejado en el próximo fetch)
      return [...prev, guardado]
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-tertiary py-3">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando requisitos…
      </div>
    )
  }

  if (errorMsg) {
    return <p className="text-sm text-danger py-3">{errorMsg}</p>
  }

  const sinRequisitos = !requisitos || requisitos.length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          Requisitos {!sinRequisitos && `(${requisitos.length})`}
        </p>
        {puedeEditar && (
          <button
            type="button"
            onClick={abrirCrear}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Agregar requisito
          </button>
        )}
      </div>

      {sinRequisitos ? (
        <p className="text-sm text-text-tertiary py-2">Esta norma no tiene requisitos cargados.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requisitos.map((r) => (
            <RequisitoItem
              key={r.id}
              req={r}
              puedeEditar={puedeEditar}
              onEdit={abrirEditar}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      <NormativaRequisitoFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        normaId={normaId}
        requisito={editTarget}
        onSaved={handleSaved}
      />
    </div>
  )
}
