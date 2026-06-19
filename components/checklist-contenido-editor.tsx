'use client'

import { useState, useTransition, useEffect } from 'react'
import { Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  getChecklistContenido,
  createSeccion,
  updateSeccion,
  deleteSeccion,
  createItem,
  updateItem,
  deleteItem,
  type FormularioSeccion,
  type FormularioItem,
} from '@/lib/actions/formularios-contenido'

// ─── tipos ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  gestionId: string
  gestionNombre: string
}

const inputSmCls =
  'flex-1 border border-border-default rounded-lg px-2.5 py-1.5 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/40 min-w-0'

// ─── sub-componente: ítem editable ───────────────────────────────────────────

interface ItemRowProps {
  item: FormularioItem
  onUpdated: (updated: FormularioItem) => void
  onDeleted: (id: string) => void
}

function ItemRow({ item, onUpdated, onDeleted }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.question)
  const [draftRequired, setDraftRequired] = useState(item.required)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function cancelEdit() {
    setDraft(item.question)
    setDraftRequired(item.required)
    setEditing(false)
    setError(null)
  }

  function saveEdit() {
    setError(null)
    startTransition(async () => {
      const res = await updateItem(item.id, draft, draftRequired)
      if (!res.success) { setError(res.error); return }
      onUpdated(res.data)
      setEditing(false)
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar este ítem?')) return
    startTransition(async () => {
      const res = await deleteItem(item.id)
      if (!res.success) { setError(res.error); return }
      onDeleted(item.id)
    })
  }

  return (
    <div className="group flex items-start gap-2 py-1.5 px-2 rounded hover:bg-surface-elevated/60 transition-colors">
      <span className="shrink-0 w-5 text-xs text-text-tertiary pt-1.5 text-right select-none">
        {item.numero_item ?? '—'}
      </span>

      {editing ? (
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input
              className={inputSmCls}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveEdit() }
                if (e.key === 'Escape') cancelEdit()
              }}
            />
            <button
              type="button"
              onClick={saveEdit}
              disabled={isPending || !draft.trim()}
              className="shrink-0 p-1.5 rounded text-green-600 hover:text-green-700 disabled:opacity-40"
              title="Guardar"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="shrink-0 p-1.5 rounded text-text-tertiary hover:text-text-primary"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draftRequired}
              onChange={e => setDraftRequired(e.target.checked)}
              className="rounded"
            />
            Respuesta obligatoria
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-text-primary break-words">{item.question}</span>
            {item.required && (
              <span className="ml-2 text-xs text-brand-primary font-medium">obligatorio</span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1.5 rounded text-text-tertiary hover:text-text-primary"
              title="Editar ítem"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="p-1.5 rounded text-red-400 hover:text-danger disabled:opacity-40"
              title="Eliminar ítem"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── sub-componente: sección editable ───────────────────────────────────────

interface SeccionBlockProps {
  seccion: FormularioSeccion
  onSeccionUpdated: (updated: FormularioSeccion) => void
  onSeccionDeleted: (id: string) => void
}

function SeccionBlock({ seccion, onSeccionUpdated, onSeccionDeleted }: SeccionBlockProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(seccion.title)
  const [addingItem, setAddingItem] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // items local state (empieza desde la prop)
  const [items, setItems] = useState<FormularioItem[]>(seccion.formularios_items)

  function cancelTitleEdit() {
    setDraftTitle(seccion.title)
    setEditingTitle(false)
    setError(null)
  }

  function saveTitle() {
    setError(null)
    startTransition(async () => {
      const res = await updateSeccion(seccion.id, draftTitle)
      if (!res.success) { setError(res.error); return }
      onSeccionUpdated({ ...seccion, title: draftTitle, formularios_items: items })
      setEditingTitle(false)
    })
  }

  function handleDeleteSeccion() {
    if (!confirm(`¿Eliminar la sección «${seccion.title}» y todos sus ítems?`)) return
    startTransition(async () => {
      const res = await deleteSeccion(seccion.id)
      if (!res.success) { setError(res.error); return }
      onSeccionDeleted(seccion.id)
    })
  }

  function handleAddItem() {
    if (!newQuestion.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await createItem(seccion.id, newQuestion)
      if (!res.success) { setError(res.error); return }
      setItems(prev => [...prev, res.data])
      setNewQuestion('')
      setAddingItem(false)
    })
  }

  function handleItemUpdated(updated: FormularioItem) {
    setItems(prev => prev.map(it => (it.id === updated.id ? updated : it)))
  }

  function handleItemDeleted(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      {/* cabecera sección */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-elevated/50">
        {editingTitle ? (
          <>
            <input
              className={inputSmCls}
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
                if (e.key === 'Escape') cancelTitleEdit()
              }}
            />
            <button
              type="button"
              onClick={saveTitle}
              disabled={isPending || !draftTitle.trim()}
              className="shrink-0 p-1.5 rounded text-green-600 hover:text-green-700 disabled:opacity-40"
              title="Guardar título"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={cancelTitleEdit}
              className="shrink-0 p-1.5 rounded text-text-tertiary hover:text-text-primary"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 font-semibold text-sm text-text-primary truncate">
              {seccion.title}
            </span>
            <span className="text-xs text-text-tertiary shrink-0">
              {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
            </span>
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="shrink-0 p-1.5 rounded text-text-tertiary hover:text-text-primary"
              title="Editar título"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteSeccion}
              disabled={isPending}
              className="shrink-0 p-1.5 rounded text-red-400 hover:text-danger disabled:opacity-40"
              title="Eliminar sección"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>

      {/* error de sección */}
      {error && (
        <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {/* lista de ítems */}
      <div className="divide-y divide-border-subtle/50 px-1 py-1">
        {items.length === 0 && !addingItem && (
          <p className="text-xs text-text-tertiary text-center py-3">
            Sin ítems. Agregá el primero.
          </p>
        )}
        {items.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            onUpdated={handleItemUpdated}
            onDeleted={handleItemDeleted}
          />
        ))}

        {/* add ítem inline */}
        {addingItem && (
          <div className="flex items-center gap-2 py-2 px-2">
            <input
              className={inputSmCls}
              placeholder="Nueva pregunta…"
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddItem() }
                if (e.key === 'Escape') { setAddingItem(false); setNewQuestion('') }
              }}
            />
            <button
              type="button"
              onClick={handleAddItem}
              disabled={isPending || !newQuestion.trim()}
              className="shrink-0 p-1.5 rounded text-green-600 hover:text-green-700 disabled:opacity-40"
              title="Agregar ítem"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => { setAddingItem(false); setNewQuestion('') }}
              className="shrink-0 p-1.5 rounded text-text-tertiary hover:text-text-primary"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* footer: agregar ítem */}
      <div className="px-3 py-2 border-t border-border-subtle/50">
        <button
          type="button"
          onClick={() => setAddingItem(true)}
          disabled={addingItem}
          className="flex items-center gap-1.5 text-xs text-brand-primary hover:underline disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar ítem
        </button>
      </div>
    </div>
  )
}

// ─── componente principal ────────────────────────────────────────────────────

export function ChecklistContenidoEditor({ open, onClose, gestionId, gestionNombre }: Props) {
  const [secciones, setSecciones] = useState<FormularioSeccion[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // nueva sección
  const [addingSeccion, setAddingSeccion] = useState(false)
  const [newSeccionTitle, setNewSeccionTitle] = useState('')
  const [isPending, startTransition] = useTransition()

  // carga al abrir el modal
  useEffect(() => {
    if (!open) return
    setSecciones(null)
    setError(null)
    setAddingSeccion(false)
    setNewSeccionTitle('')
    setLoading(true)
    getChecklistContenido(gestionId).then(res => {
      setLoading(false)
      if (!res.success) { setError(res.error); return }
      setSecciones(res.data)
    })
  }, [open, gestionId])

  function handleSeccionUpdated(updated: FormularioSeccion) {
    setSecciones(prev => prev?.map(s => (s.id === updated.id ? { ...updated, formularios_items: s.formularios_items } : s)) ?? null)
  }

  function handleSeccionDeleted(id: string) {
    setSecciones(prev => prev?.filter(s => s.id !== id) ?? null)
  }

  function handleAddSeccion() {
    if (!newSeccionTitle.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await createSeccion(gestionId, newSeccionTitle)
      if (!res.success) { setError(res.error); return }
      setSecciones(prev => [...(prev ?? []), res.data])
      setNewSeccionTitle('')
      setAddingSeccion(false)
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ítems: ${gestionNombre}`}
      size="wide"
    >
      <div className="flex flex-col gap-4 min-h-[10rem]">
        {/* estado de carga */}
        {loading && (
          <div className="flex items-center justify-center py-10 text-text-tertiary gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando…</span>
          </div>
        )}

        {/* error global */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* secciones */}
        {!loading && secciones !== null && (
          <>
            {secciones.length === 0 && !addingSeccion && (
              <p className="text-sm text-text-tertiary text-center py-4">
                Este checklist no tiene secciones. Agregá la primera.
              </p>
            )}

            <div className="space-y-3">
              {secciones.map(sec => (
                <SeccionBlock
                  key={sec.id}
                  seccion={sec}
                  onSeccionUpdated={handleSeccionUpdated}
                  onSeccionDeleted={handleSeccionDeleted}
                />
              ))}
            </div>

            {/* agregar sección */}
            {addingSeccion ? (
              <div className="flex items-center gap-2 border border-border-default rounded-lg px-3 py-2.5 bg-surface-elevated/40">
                <input
                  className={inputSmCls}
                  placeholder="Título de la nueva sección…"
                  value={newSeccionTitle}
                  onChange={e => setNewSeccionTitle(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddSeccion() }
                    if (e.key === 'Escape') { setAddingSeccion(false); setNewSeccionTitle('') }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddSeccion}
                  disabled={isPending || !newSeccionTitle.trim()}
                  className="shrink-0 p-1.5 rounded text-green-600 hover:text-green-700 disabled:opacity-40"
                  title="Crear sección"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingSeccion(false); setNewSeccionTitle('') }}
                  className="shrink-0 p-1.5 rounded text-text-tertiary hover:text-text-primary"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAddingSeccion(true)}
                className="self-start"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar sección
              </Button>
            )}
          </>
        )}

        {/* footer */}
        <div className="flex justify-end pt-2 border-t border-border-subtle mt-auto">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  )
}
