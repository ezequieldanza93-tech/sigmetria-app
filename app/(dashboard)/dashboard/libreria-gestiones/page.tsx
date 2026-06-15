'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, FolderOpen, Layers, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { OrigenFilter, pasaOrigen, OrigenBadge, type OrigenFiltro } from '@/components/ui/origen-filter'
import { useLibreriaGestiones } from '@/lib/queries/gestiones-libreria'
import {
  createGrupoGestion, updateGrupoGestion, deleteGrupoGestion,
  createCategoriaGestion, updateCategoriaGestion, deleteCategoriaGestion,
  createGestion, updateGestion, deleteGestion,
} from '@/lib/actions/gestiones-libreria'
import { LIMITE_GRUPOS, LIMITE_CATEGORIAS } from '@/lib/gestiones/limites'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Nivel = 'grupo' | 'categoria' | 'gestion'
type Vista = 'arbol' | 'tablas'

interface ModalEditar {
  nivel: 'grupo' | 'categoria'
  id: string
  nombre: string
  grupoId: string
  descripcion: string
}

interface ModalGestion {
  mode: 'crear' | 'editar'
  id?: string
  nombre: string
  grupoId: string
  categoriaId: string
  descripcion: string
  // sub-form inline
  inlineGrupoNombre: string
  inlineCatNombre: string
  inlineCatDesc: string
  inlineStep: 'none' | 'nuevo-grupo' | 'nueva-cat'
}

const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/40'
const inputSmCls = 'w-full border border-border-default rounded-lg px-2.5 py-1.5 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-brand-primary/40'

// ─── helpers ──────────────────────────────────────────────────────────────────

function LimiteTag({ actual, limite, label }: { actual: number; limite: number; label: string }) {
  const lleno = actual >= limite
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
      lleno
        ? 'bg-red-50 border-red-200 text-red-600'
        : 'bg-surface-elevated border-border-subtle text-text-tertiary'
    }`}>
      {label}: {actual}/{limite}
    </span>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function LibreriaGestionesPage() {
  const { data, isLoading, refetch } = useLibreriaGestiones()
  const ctx = useEffectiveRoleContext()
  const canEdit = ctx?.isSuperAdmin || ctx?.userRole === 'full_access_main' || ctx?.userRole === 'full_access_branch'

  const [vista, setVista] = useState<Vista>('arbol')
  const [origen, setOrigen] = useState<OrigenFiltro>('todos')
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(new Set())
  const [openCats, setOpenCats] = useState<Set<string>>(new Set())

  // modal editar grupo / categoría
  const [modalEditar, setModalEditar] = useState<ModalEditar | null>(null)
  const [savingEditar, setSavingEditar] = useState(false)
  const [errorEditar, setErrorEditar] = useState<string | null>(null)

  // modal nueva / editar gestión
  const [modalGestion, setModalGestion] = useState<ModalGestion | null>(null)
  const [savingGestion, setSavingGestion] = useState(false)
  const [errorGestion, setErrorGestion] = useState<string | null>(null)

  const grupos = data?.grupos ?? []
  const categorias = data?.categorias ?? []
  const gestiones = data?.gestiones ?? []

  const gruposPropios = grupos.filter(g => g.consultora_id !== null).length
  const catPropias = categorias.filter(c => c.consultora_id !== null).length

  // Filtro de origen respetando jerarquía
  const gestVis = gestiones.filter(g => pasaOrigen(g.consultora_id, origen))
  const gestByCat = new Set(gestVis.map(g => g.categoria_id))
  const catsVis = categorias.filter(c => pasaOrigen(c.consultora_id, origen) || gestByCat.has(c.id))
  const catByGrupo = new Set(catsVis.map(c => c.grupo_id))
  const gruposVis = grupos.filter(g => pasaOrigen(g.consultora_id, origen) || catByGrupo.has(g.id))

  // ─── helpers UI ─────────────────────────────────────────────────────────────

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    setter(next)
  }

  function abrirNuevaGestion(categoriaId = '', grupoId = '') {
    setModalGestion({
      mode: 'crear',
      nombre: '', grupoId, categoriaId, descripcion: '',
      inlineGrupoNombre: '', inlineCatNombre: '', inlineCatDesc: '',
      inlineStep: 'none',
    })
    setErrorGestion(null)
  }

  function abrirEditarGestion(g: { id: string; nombre: string; categoria_id: string; descripcion: string | null }) {
    const cat = categorias.find(c => c.id === g.categoria_id)
    setModalGestion({
      mode: 'editar', id: g.id,
      nombre: g.nombre,
      grupoId: cat?.grupo_id ?? '',
      categoriaId: g.categoria_id,
      descripcion: g.descripcion ?? '',
      inlineGrupoNombre: '', inlineCatNombre: '', inlineCatDesc: '',
      inlineStep: 'none',
    })
    setErrorGestion(null)
  }

  // ─── submit modal editar grupo/cat ──────────────────────────────────────────

  async function submitEditar() {
    if (!modalEditar) return
    setSavingEditar(true); setErrorEditar(null)
    const res = modalEditar.nivel === 'grupo'
      ? await updateGrupoGestion(modalEditar.id, modalEditar.nombre)
      : await updateCategoriaGestion(modalEditar.id, modalEditar.nombre, modalEditar.grupoId, modalEditar.descripcion)
    setSavingEditar(false)
    if (!res.success) { setErrorEditar(res.error ?? 'Error'); return }
    setModalEditar(null); refetch()
  }

  // ─── submit modal gestión ───────────────────────────────────────────────────

  async function submitGestion() {
    if (!modalGestion) return
    setSavingGestion(true); setErrorGestion(null)
    const res = modalGestion.mode === 'crear'
      ? await createGestion(modalGestion.nombre, modalGestion.categoriaId, modalGestion.descripcion)
      : await updateGestion(modalGestion.id!, modalGestion.nombre, modalGestion.categoriaId, modalGestion.descripcion)
    setSavingGestion(false)
    if (!res.success) { setErrorGestion(res.error ?? 'Error'); return }
    setModalGestion(null); refetch()
  }

  // ─── crear grupo inline ─────────────────────────────────────────────────────

  async function crearGrupoInline() {
    if (!modalGestion || !modalGestion.inlineGrupoNombre.trim()) return
    setSavingGestion(true); setErrorGestion(null)
    const res = await createGrupoGestion(modalGestion.inlineGrupoNombre.trim())
    setSavingGestion(false)
    if (!res.success) { setErrorGestion(res.error ?? 'Error'); return }
    await refetch()
    // seleccionar el nuevo grupo y cerrar sub-form
    setModalGestion(g => g
      ? { ...g, grupoId: res.data.id, categoriaId: '', inlineGrupoNombre: '', inlineStep: 'none' }
      : g
    )
  }

  // ─── crear categoría inline ─────────────────────────────────────────────────

  async function crearCatInline() {
    if (!modalGestion || !modalGestion.inlineCatNombre.trim() || !modalGestion.grupoId) return
    setSavingGestion(true); setErrorGestion(null)
    const res = await createCategoriaGestion(
      modalGestion.inlineCatNombre.trim(),
      modalGestion.grupoId,
      modalGestion.inlineCatDesc.trim() || undefined,
    )
    setSavingGestion(false)
    if (!res.success) { setErrorGestion(res.error ?? 'Error'); return }
    await refetch()
    setModalGestion(g => g
      ? { ...g, categoriaId: res.data.id, inlineCatNombre: '', inlineCatDesc: '', inlineStep: 'none' }
      : g
    )
  }

  // ─── eliminar ────────────────────────────────────────────────────────────────

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

  // ─── categorías filtradas por grupo seleccionado (modal gestión) ─────────────
  const catsPorGrupo = modalGestion?.grupoId
    ? categorias.filter(c => c.grupo_id === modalGestion.grupoId)
    : []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Librería de Gestiones</h1>
          <p className="text-sm text-text-secondary mt-1">
            Grupos, categorías y gestiones base de Sigmetría — disponibles para todas. Cada consultora puede sumar las suyas.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => abrirNuevaGestion()}>
            <Plus className="w-4 h-4 mr-1" /> Nueva gestión
          </Button>
        )}
      </div>

      {/* ── Barra de filtros + contadores + tabs ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <OrigenFilter value={origen} onChange={setOrigen} />
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <LimiteTag actual={gruposPropios} limite={LIMITE_GRUPOS} label="Grupos" />
          <LimiteTag actual={catPropias} limite={LIMITE_CATEGORIAS} label="Categorías" />
        </div>
      </div>

      {/* ── Tabs árbol / tablas ── */}
      <div className="flex gap-1 mb-4 border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setVista('arbol')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            vista === 'arbol'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ChevronRight className="w-3.5 h-3.5" /> Árbol
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => setVista('tablas')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              vista === 'tablas'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Grupos y categorías
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VISTA: ÁRBOL                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {vista === 'arbol' && (
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
                      <button
                        onClick={() => setModalEditar({ nivel: 'grupo', id: grupo.id, nombre: grupo.nombre, grupoId: '', descripcion: '' })}
                        className="text-text-tertiary hover:text-text-primary"
                        title="Editar grupo"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminar('grupo', grupo.id)} className="text-red-400 hover:text-danger" title="Eliminar grupo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {abierto && (
                  <div className="px-3 pb-3 pl-8 space-y-2">
                    {canEdit && (
                      <Button variant="secondary" size="sm" onClick={() => abrirNuevaGestion('', grupo.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nueva gestión en este grupo
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
                                <button
                                  onClick={() => setModalEditar({ nivel: 'categoria', id: cat.id, nombre: cat.nombre, grupoId: cat.grupo_id, descripcion: cat.descripcion ?? '' })}
                                  className="text-text-tertiary hover:text-text-primary"
                                  title="Editar categoría"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => eliminar('categoria', cat.id)} className="text-red-400 hover:text-danger" title="Eliminar categoría">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                          {abiertaC && (
                            <div className="px-2.5 pb-2.5 pl-7 space-y-1">
                              {canEdit && (
                                <Button variant="secondary" size="sm" onClick={() => abrirNuevaGestion(cat.id, cat.grupo_id)}>
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
                                        <button onClick={() => abrirEditarGestion(g)} className="text-text-tertiary hover:text-text-primary" title="Editar gestión">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => eliminar('gestion', g.id)} className="text-red-400 hover:text-danger" title="Eliminar gestión">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VISTA: TABLAS (grupos + categorías editables)                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {vista === 'tablas' && canEdit && (
        <div className="space-y-8">

          {/* ── Tabla de Grupos ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-text-secondary" />
                <h2 className="font-semibold text-text-primary">Grupos</h2>
                <LimiteTag actual={gruposPropios} limite={LIMITE_GRUPOS} label="propios" />
              </div>
              {gruposPropios < LIMITE_GRUPOS && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalEditar({ nivel: 'grupo', id: '', nombre: '', grupoId: '', descripcion: '' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo grupo
                </Button>
              )}
              {gruposPropios >= LIMITE_GRUPOS && (
                <span className="text-xs text-text-tertiary">Límite alcanzado</span>
              )}
            </div>

            <div className="border border-border-subtle rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated text-text-secondary text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Nombre</th>
                    <th className="px-4 py-2.5 text-left font-medium">Origen</th>
                    <th className="px-4 py-2.5 text-left font-medium">Categorías</th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {grupos.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-text-tertiary">No hay grupos.</td></tr>
                  )}
                  {grupos.map(g => {
                    const nCats = categorias.filter(c => c.grupo_id === g.id).length
                    const propio = g.consultora_id !== null
                    return (
                      <tr key={g.id} className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">{g.nombre}</td>
                        <td className="px-4 py-3"><OrigenBadge consultoraId={g.consultora_id} /></td>
                        <td className="px-4 py-3 text-text-secondary">{nCats}</td>
                        <td className="px-4 py-3">
                          {propio ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setModalEditar({ nivel: 'grupo', id: g.id, nombre: g.nombre, grupoId: '', descripcion: '' })}
                                className="text-text-tertiary hover:text-text-primary"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminar('grupo', g.id)} className="text-red-400 hover:text-danger" title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-text-tertiary text-right block">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {gruposPropios >= LIMITE_GRUPOS && (
              <p className="text-xs text-text-tertiary mt-2">
                Llegaste al máximo de {LIMITE_GRUPOS} grupos propios. Para agregar uno nuevo, eliminá un grupo propio existente.
              </p>
            )}
          </section>

          {/* ── Tabla de Categorías ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-text-secondary" />
                <h2 className="font-semibold text-text-primary">Categorías</h2>
                <LimiteTag actual={catPropias} limite={LIMITE_CATEGORIAS} label="propias" />
              </div>
              {catPropias < LIMITE_CATEGORIAS ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalEditar({ nivel: 'categoria', id: '', nombre: '', grupoId: grupos[0]?.id ?? '', descripcion: '' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nueva categoría
                </Button>
              ) : (
                <span className="text-xs text-text-tertiary">Límite alcanzado</span>
              )}
            </div>

            <div className="border border-border-subtle rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated text-text-secondary text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Nombre</th>
                    <th className="px-4 py-2.5 text-left font-medium">Grupo</th>
                    <th className="px-4 py-2.5 text-left font-medium">Origen</th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {categorias.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-text-tertiary">No hay categorías.</td></tr>
                  )}
                  {categorias.map(c => {
                    const grupoNombre = grupos.find(g => g.id === c.grupo_id)?.nombre ?? '—'
                    const propio = c.consultora_id !== null
                    return (
                      <tr key={c.id} className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">{c.nombre}</td>
                        <td className="px-4 py-3 text-text-secondary">{grupoNombre}</td>
                        <td className="px-4 py-3"><OrigenBadge consultoraId={c.consultora_id} /></td>
                        <td className="px-4 py-3">
                          {propio ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setModalEditar({ nivel: 'categoria', id: c.id, nombre: c.nombre, grupoId: c.grupo_id, descripcion: c.descripcion ?? '' })}
                                className="text-text-tertiary hover:text-text-primary"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminar('categoria', c.id)} className="text-red-400 hover:text-danger" title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-text-tertiary text-right block">Solo lectura</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {catPropias >= LIMITE_CATEGORIAS && (
              <p className="text-xs text-text-tertiary mt-2">
                Llegaste al máximo de {LIMITE_CATEGORIAS} categorías propias. Para agregar una nueva, eliminá una propia existente.
              </p>
            )}
          </section>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: editar grupo / crear grupo / editar cat / crear cat             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalEditar !== null}
        onClose={() => { setModalEditar(null); setErrorEditar(null) }}
        title={
          modalEditar
            ? `${!modalEditar.id ? 'Nuevo' : 'Editar'} ${modalEditar.nivel === 'grupo' ? 'grupo' : 'categoría'}`
            : ''
        }
      >
        {modalEditar && (
          <div className="flex flex-col gap-4">
            {errorEditar && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{errorEditar}</div>
            )}

            {modalEditar.nivel === 'grupo' && !modalEditar.id && (
              <p className="text-xs text-text-tertiary bg-surface-elevated rounded-lg p-3">
                Un grupo debe ser un <strong>concepto genérico</strong> (como Auditorías, Formaciones, Reuniones). El máximo de {LIMITE_GRUPOS} grupos propios existe para conservar el orden y que los reportes sean comparables entre consultoras.
              </p>
            )}

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
              <input
                className={inputCls}
                value={modalEditar.nombre}
                onChange={e => setModalEditar({ ...modalEditar, nombre: e.target.value })}
                autoFocus
              />
            </div>

            {modalEditar.nivel === 'categoria' && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Grupo *</label>
                <select
                  className={inputCls}
                  value={modalEditar.grupoId}
                  onChange={e => setModalEditar({ ...modalEditar, grupoId: e.target.value })}
                >
                  <option value="">Seleccioná…</option>
                  {grupos.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}{g.consultora_id === null ? ' (base)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {modalEditar.nivel === 'categoria' && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Descripción</label>
                <textarea
                  className={inputCls}
                  rows={2}
                  value={modalEditar.descripcion}
                  onChange={e => setModalEditar({ ...modalEditar, descripcion: e.target.value })}
                  placeholder="Opcional…"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setModalEditar(null); setErrorEditar(null) }}>Cancelar</Button>
              <Button
                onClick={async () => {
                  if (!modalEditar.id) {
                    // crear
                    setSavingEditar(true); setErrorEditar(null)
                    const res = modalEditar.nivel === 'grupo'
                      ? await createGrupoGestion(modalEditar.nombre)
                      : await createCategoriaGestion(modalEditar.nombre, modalEditar.grupoId, modalEditar.descripcion)
                    setSavingEditar(false)
                    if (!res.success) { setErrorEditar(res.error ?? 'Error'); return }
                    setModalEditar(null); refetch()
                  } else {
                    await submitEditar()
                  }
                }}
                disabled={savingEditar}
              >
                {savingEditar ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: nueva / editar gestión (flujo grupo → categoría + inline)      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalGestion !== null}
        onClose={() => { setModalGestion(null); setErrorGestion(null) }}
        title={modalGestion?.mode === 'crear' ? 'Nueva gestión' : 'Editar gestión'}
      >
        {modalGestion && (
          <div className="flex flex-col gap-5">
            {errorGestion && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{errorGestion}</div>
            )}

            {/* ── Nombre gestión ── */}
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Nombre de la gestión *</label>
              <input
                className={inputCls}
                value={modalGestion.nombre}
                onChange={e => setModalGestion({ ...modalGestion, nombre: e.target.value })}
                autoFocus
                placeholder="ej. Auditoría anual de seguridad"
              />
            </div>

            {/* ── Descripción ── */}
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Descripción</label>
              <textarea
                className={inputCls}
                rows={2}
                value={modalGestion.descripcion}
                onChange={e => setModalGestion({ ...modalGestion, descripcion: e.target.value })}
                placeholder="Opcional…"
              />
            </div>

            {/* ── Paso 1: Grupo ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-text-secondary">Grupo *</label>
                {/* Botón crear nuevo grupo — solo si no estamos en sub-form y hay lugar */}
                {modalGestion.inlineStep !== 'nuevo-grupo' && gruposPropios < LIMITE_GRUPOS && (
                  <button
                    type="button"
                    onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'nuevo-grupo', inlineGrupoNombre: '' })}
                    className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Crear nuevo
                  </button>
                )}
                {modalGestion.inlineStep !== 'nuevo-grupo' && gruposPropios >= LIMITE_GRUPOS && (
                  <span className="text-xs text-red-500">Límite de {LIMITE_GRUPOS} grupos propios alcanzado</span>
                )}
              </div>

              {/* Sub-form inline: nuevo grupo */}
              {modalGestion.inlineStep === 'nuevo-grupo' && (
                <div className="bg-surface-elevated border border-border-subtle rounded-lg p-3 mb-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Nuevo grupo</span>
                    <button
                      type="button"
                      onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'none', inlineGrupoNombre: '' })}
                      className="text-text-tertiary hover:text-text-primary"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className={inputSmCls}
                    placeholder="Nombre del grupo…"
                    value={modalGestion.inlineGrupoNombre}
                    onChange={e => setModalGestion({ ...modalGestion, inlineGrupoNombre: e.target.value })}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearGrupoInline() } }}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'none', inlineGrupoNombre: '' })}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={crearGrupoInline}
                      disabled={savingGestion || !modalGestion.inlineGrupoNombre.trim()}
                    >
                      {savingGestion ? 'Creando…' : 'Crear y usar'}
                    </Button>
                  </div>
                </div>
              )}

              <select
                className={inputCls}
                value={modalGestion.grupoId}
                onChange={e => setModalGestion({ ...modalGestion, grupoId: e.target.value, categoriaId: '' })}
              >
                <option value="">Seleccioná un grupo…</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}{g.consultora_id === null ? ' (base)' : ''}</option>
                ))}
              </select>
            </div>

            {/* ── Paso 2: Categoría (solo si hay grupo seleccionado) ── */}
            {modalGestion.grupoId && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-text-secondary">Categoría *</label>
                  {modalGestion.inlineStep !== 'nueva-cat' && catPropias < LIMITE_CATEGORIAS && (
                    <button
                      type="button"
                      onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'nueva-cat', inlineCatNombre: '', inlineCatDesc: '' })}
                      className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Crear nueva
                    </button>
                  )}
                  {modalGestion.inlineStep !== 'nueva-cat' && catPropias >= LIMITE_CATEGORIAS && (
                    <span className="text-xs text-red-500">Límite de {LIMITE_CATEGORIAS} categorías propias alcanzado</span>
                  )}
                </div>

                {/* Sub-form inline: nueva categoría */}
                {modalGestion.inlineStep === 'nueva-cat' && (
                  <div className="bg-surface-elevated border border-border-subtle rounded-lg p-3 mb-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Nueva categoría en «{grupos.find(g => g.id === modalGestion.grupoId)?.nombre}»
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'none', inlineCatNombre: '', inlineCatDesc: '' })}
                        className="text-text-tertiary hover:text-text-primary"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      className={inputSmCls}
                      placeholder="Nombre de la categoría…"
                      value={modalGestion.inlineCatNombre}
                      onChange={e => setModalGestion({ ...modalGestion, inlineCatNombre: e.target.value })}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); crearCatInline() } }}
                    />
                    <input
                      className={inputSmCls}
                      placeholder="Descripción (opcional)…"
                      value={modalGestion.inlineCatDesc}
                      onChange={e => setModalGestion({ ...modalGestion, inlineCatDesc: e.target.value })}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'none', inlineCatNombre: '', inlineCatDesc: '' })}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={crearCatInline}
                        disabled={savingGestion || !modalGestion.inlineCatNombre.trim()}
                      >
                        {savingGestion ? 'Creando…' : 'Crear y usar'}
                      </Button>
                    </div>
                  </div>
                )}

                <select
                  className={inputCls}
                  value={modalGestion.categoriaId}
                  onChange={e => setModalGestion({ ...modalGestion, categoriaId: e.target.value })}
                >
                  <option value="">Seleccioná una categoría…</option>
                  {catsPorGrupo.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.consultora_id === null ? ' (base)' : ''}</option>
                  ))}
                </select>
                {catsPorGrupo.length === 0 && (
                  <p className="text-xs text-text-tertiary mt-1">
                    No hay categorías en este grupo.
                    {catPropias < LIMITE_CATEGORIAS ? ' Creá una nueva con el botón de arriba.' : ''}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1 border-t border-border-subtle">
              <Button variant="secondary" onClick={() => { setModalGestion(null); setErrorGestion(null) }}>Cancelar</Button>
              <Button
                onClick={submitGestion}
                disabled={
                  savingGestion ||
                  !modalGestion.nombre.trim() ||
                  !modalGestion.grupoId ||
                  !modalGestion.categoriaId ||
                  modalGestion.inlineStep !== 'none'
                }
              >
                {savingGestion ? 'Guardando…' : 'Guardar gestión'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
