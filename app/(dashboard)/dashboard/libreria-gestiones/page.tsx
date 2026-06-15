'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { OrigenFilter, pasaOrigen, OrigenBadge, type OrigenFiltro } from '@/components/ui/origen-filter'
import { useLibreriaGestiones } from '@/lib/queries/gestiones-libreria'
import {
  createGrupoGestion, updateGrupoGestion, deleteGrupoGestion,
  createCategoriaGestion, updateCategoriaGestion, deleteCategoriaGestion,
  createGestion, updateGestion, deleteGestion,
  LIMITE_GRUPOS, LIMITE_CATEGORIAS,
} from '@/lib/actions/gestiones-libreria'

type Nivel = 'grupo' | 'categoria' | 'gestion'
interface ModalState {
  nivel: Nivel
  mode: 'crear' | 'editar'
  id?: string
  nombre: string
  grupoId: string
  categoriaId: string
  descripcion: string
}

const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base'

export default function LibreriaGestionesPage() {
  const { data, isLoading, refetch } = useLibreriaGestiones()
  const ctx = useEffectiveRoleContext()
  const canEdit = ctx?.isSuperAdmin || ctx?.userRole === 'full_access_main' || ctx?.userRole === 'full_access_branch'

  const [origen, setOrigen] = useState<OrigenFiltro>('todos')
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(new Set())
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grupos = data?.grupos ?? []
  const categorias = data?.categorias ?? []
  const gestiones = data?.gestiones ?? []

  const gruposPropios = grupos.filter(g => g.consultora_id !== null).length
  const catPropias = categorias.filter(c => c.consultora_id !== null).length

  // Filtro de origen respetando la jerarquía: un padre se muestra si pasa el
  // filtro O si tiene descendientes que pasan.
  const { gruposVis, catsVis, gestVis } = useMemo(() => {
    const gestVis = gestiones.filter(g => pasaOrigen(g.consultora_id, origen))
    const gestByCat = new Set(gestVis.map(g => g.categoria_id))
    const catsVis = categorias.filter(c => pasaOrigen(c.consultora_id, origen) || gestByCat.has(c.id))
    const catByGrupo = new Set(catsVis.map(c => c.grupo_id))
    const gruposVis = grupos.filter(g => pasaOrigen(g.consultora_id, origen) || catByGrupo.has(g.id))
    return { gruposVis, catsVis, gestVis }
  }, [grupos, categorias, gestiones, origen])

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  async function submitModal() {
    if (!modal) return
    setSaving(true); setError(null)
    let res: { success: boolean; error?: string }
    if (modal.nivel === 'grupo') {
      res = modal.mode === 'crear'
        ? await createGrupoGestion(modal.nombre)
        : await updateGrupoGestion(modal.id!, modal.nombre)
    } else if (modal.nivel === 'categoria') {
      res = modal.mode === 'crear'
        ? await createCategoriaGestion(modal.nombre, modal.grupoId, modal.descripcion)
        : await updateCategoriaGestion(modal.id!, modal.nombre, modal.grupoId, modal.descripcion)
    } else {
      res = modal.mode === 'crear'
        ? await createGestion(modal.nombre, modal.categoriaId, modal.descripcion)
        : await updateGestion(modal.id!, modal.nombre, modal.categoriaId, modal.descripcion)
    }
    setSaving(false)
    if (!res.success) { setError(res.error ?? 'Error'); return }
    setModal(null); refetch()
  }

  async function eliminar(nivel: Nivel, id: string) {
    const msg = nivel === 'grupo'
      ? '¿Eliminar este grupo propio? Se borran también sus categorías y gestiones propias.'
      : nivel === 'categoria'
        ? '¿Eliminar esta categoría propia? Se borran también sus gestiones propias.'
        : '¿Eliminar esta gestión propia?'
    if (!confirm(msg)) return
    const res = nivel === 'grupo' ? await deleteGrupoGestion(id)
      : nivel === 'categoria' ? await deleteCategoriaGestion(id)
        : await deleteGestion(id)
    if (!res.success) { alert(res.error); return }
    refetch()
  }

  if (isLoading) return <div className="p-8 text-text-tertiary">Cargando…</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Librería de Gestiones</h1>
          <p className="text-sm text-text-secondary mt-1">
            Grupos, categorías y gestiones base de Sigmetría — disponibles para todas. Cada consultora puede sumar las suyas.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setModal({ nivel: 'grupo', mode: 'crear', nombre: '', grupoId: '', categoriaId: '', descripcion: '' })}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo grupo
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-5 flex-wrap text-xs text-text-tertiary">
        <OrigenFilter value={origen} onChange={setOrigen} />
        <span>Grupos propios: <strong className={gruposPropios >= LIMITE_GRUPOS ? 'text-danger' : 'text-text-secondary'}>{gruposPropios}/{LIMITE_GRUPOS}</strong></span>
        <span>Categorías propias: <strong className={catPropias >= LIMITE_CATEGORIAS ? 'text-danger' : 'text-text-secondary'}>{catPropias}/{LIMITE_CATEGORIAS}</strong></span>
      </div>

      <div className="space-y-2">
        {gruposVis.map(grupo => {
          const cats = catsVis.filter(c => c.grupo_id === grupo.id)
          const abierto = openGrupos.has(grupo.id)
          const propioG = grupo.consultora_id !== null
          return (
            <div key={grupo.id} className="border border-border-subtle rounded-lg bg-surface-base">
              <div className="flex items-center gap-2 p-3">
                <button onClick={() => toggle(openGrupos, setOpenGrupos, grupo.id)} className="flex items-center gap-2 flex-1 text-left">
                  {abierto ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="font-semibold">{grupo.nombre}</span>
                  <OrigenBadge consultoraId={grupo.consultora_id} />
                  <span className="text-xs text-text-tertiary">({cats.length})</span>
                </button>
                {canEdit && propioG && (
                  <>
                    <button onClick={() => setModal({ nivel: 'grupo', mode: 'editar', id: grupo.id, nombre: grupo.nombre, grupoId: '', categoriaId: '', descripcion: '' })} className="text-text-tertiary hover:text-text-primary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => eliminar('grupo', grupo.id)} className="text-red-400 hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>

              {abierto && (
                <div className="px-3 pb-3 pl-8 space-y-2">
                  {canEdit && (
                    <Button variant="secondary" size="sm" onClick={() => setModal({ nivel: 'categoria', mode: 'crear', nombre: '', grupoId: grupo.id, categoriaId: '', descripcion: '' })}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Nueva categoría
                    </Button>
                  )}
                  {cats.map(cat => {
                    const gests = gestVis.filter(g => g.categoria_id === cat.id)
                    const abiertaC = openCats.has(cat.id)
                    const propioC = cat.consultora_id !== null
                    return (
                      <div key={cat.id} className="border border-border-subtle rounded-lg">
                        <div className="flex items-center gap-2 p-2.5">
                          <button onClick={() => toggle(openCats, setOpenCats, cat.id)} className="flex items-center gap-2 flex-1 text-left">
                            {abiertaC ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                            <span className="font-medium text-sm">{cat.nombre}</span>
                            <OrigenBadge consultoraId={cat.consultora_id} />
                            <span className="text-xs text-text-tertiary">({gests.length})</span>
                          </button>
                          {canEdit && propioC && (
                            <>
                              <button onClick={() => setModal({ nivel: 'categoria', mode: 'editar', id: cat.id, nombre: cat.nombre, grupoId: cat.grupo_id, categoriaId: '', descripcion: cat.descripcion ?? '' })} className="text-text-tertiary hover:text-text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => eliminar('categoria', cat.id)} className="text-red-400 hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                        {abiertaC && (
                          <div className="px-2.5 pb-2.5 pl-7 space-y-1">
                            {canEdit && (
                              <Button variant="secondary" size="sm" onClick={() => setModal({ nivel: 'gestion', mode: 'crear', nombre: '', grupoId: '', categoriaId: cat.id, descripcion: '' })}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Nueva gestión
                              </Button>
                            )}
                            {gests.map(g => {
                              const propioGe = g.consultora_id !== null
                              return (
                                <div key={g.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-elevated">
                                  <span className="flex-1 text-sm">{g.nombre}</span>
                                  <OrigenBadge consultoraId={g.consultora_id} />
                                  {canEdit && propioGe && (
                                    <>
                                      <button onClick={() => setModal({ nivel: 'gestion', mode: 'editar', id: g.id, nombre: g.nombre, grupoId: '', categoriaId: g.categoria_id, descripcion: g.descripcion ?? '' })} className="text-text-tertiary hover:text-text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => eliminar('gestion', g.id)} className="text-red-400 hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                            {gests.length === 0 && <p className="text-xs text-text-tertiary py-1">Sin gestiones.</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {cats.length === 0 && <p className="text-xs text-text-tertiary">Sin categorías.</p>}
                </div>
              )}
            </div>
          )
        })}
        {gruposVis.length === 0 && <p className="text-text-tertiary text-sm">No hay nada para mostrar con este filtro.</p>}
      </div>

      {/* Modal crear/editar */}
      <Modal
        open={modal !== null}
        onClose={() => { setModal(null); setError(null) }}
        title={modal ? `${modal.mode === 'crear' ? 'Nuevo' : 'Editar'} ${modal.nivel === 'grupo' ? 'grupo' : modal.nivel === 'categoria' ? 'categoría' : 'gestión'}` : ''}
      >
        {modal && (
          <div className="flex flex-col gap-4">
            {error && <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{error}</div>}

            {modal.nivel === 'grupo' && (
              <p className="text-xs text-text-tertiary bg-surface-elevated rounded-lg p-3">
                Un grupo debe ser un <strong>concepto genérico</strong> (como Auditorías, Formaciones, Reuniones). El máximo de {LIMITE_GRUPOS} grupos propios existe para conservar el orden y que los reportes sean comparables entre consultoras.
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
              <input className={inputCls} value={modal.nombre} onChange={e => setModal({ ...modal, nombre: e.target.value })} autoFocus />
            </div>

            {modal.nivel === 'categoria' && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Grupo *</label>
                <select className={inputCls} value={modal.grupoId} onChange={e => setModal({ ...modal, grupoId: e.target.value })}>
                  <option value="">Seleccioná…</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.consultora_id === null ? ' (base)' : ''}</option>)}
                </select>
              </div>
            )}

            {modal.nivel === 'gestion' && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Categoría *</label>
                <select className={inputCls} value={modal.categoriaId} onChange={e => setModal({ ...modal, categoriaId: e.target.value })}>
                  <option value="">Seleccioná…</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.consultora_id === null ? ' (base)' : ''}</option>)}
                </select>
              </div>
            )}

            {modal.nivel !== 'grupo' && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Descripción</label>
                <textarea className={inputCls} rows={2} value={modal.descripcion} onChange={e => setModal({ ...modal, descripcion: e.target.value })} placeholder="Opcional…" />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setModal(null); setError(null) }}>Cancelar</Button>
              <Button onClick={submitModal} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
