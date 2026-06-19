'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, FolderOpen, Layers, X, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'
import { OrigenFilter, pasaOrigen, OrigenBadge, type OrigenFiltro } from '@/components/ui/origen-filter'
import { useLibreriaGestiones } from '@/lib/queries/gestiones-libreria'
import {
  createGrupoGestion, updateGrupoGestion, deleteGrupoGestion,
  createCategoriaGestion, updateCategoriaGestion, deleteCategoriaGestion,
  createGestion, updateGestion, deleteGestion,
  createChecklistCategoria, updateChecklistCategoria, deleteChecklistCategoria,
} from '@/lib/actions/gestiones-libreria'
import { LIMITE_GRUPOS, LIMITE_CATEGORIAS } from '@/lib/gestiones/limites'
import { ChecklistContenidoEditor } from '@/components/checklist-contenido-editor'

// ─── tipos ────────────────────────────────────────────────────────────────────

type Nivel = 'grupo' | 'categoria' | 'gestion' | 'checklist-cat'
type Vista = 'arbol' | 'tablas'
type Alcance = 'propia' | 'base'

interface ModalEditar {
  nivel: 'grupo' | 'categoria'
  id: string
  nombre: string
  grupoId: string
  descripcion: string
  // alcance solo relevante al crear (id === '')
  alcance: Alcance
}

// modal para crear / editar una categoría checklist (4to nivel)
interface ModalChecklistCat {
  id: string          // '' = crear
  categoriaId: string // FK → gestiones_categorias
  nombre: string
  descripcion: string
  alcance: Alcance
}

interface ModalGestion {
  mode: 'crear' | 'editar'
  id?: string
  nombre: string
  grupoId: string
  categoriaId: string
  checklistCategoriaId: string  // '' = ninguna / sin sub-nivel
  descripcion: string
  alcance: Alcance
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

// ─── select de alcance (solo para base-librarians al crear) ───────────────────

function AlcanceSelect({
  value,
  onChange,
}: {
  value: Alcance
  onChange: (v: Alcance) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium text-text-secondary block mb-1">Alcance</label>
      <select
        className={inputCls}
        value={value}
        onChange={e => onChange(e.target.value as Alcance)}
      >
        <option value="propia">De mi consultora</option>
        <option value="base">Librería base Sigmetría</option>
      </select>
    </div>
  )
}

// ─── página ───────────────────────────────────────────────────────────────────

export default function LibreriaGestionesPage() {
  const { data, isLoading, refetch } = useLibreriaGestiones()
  const ctx = useEffectiveRoleContext()
  const puedeGestionarBase = ctx?.puedeGestionarLibrerias ?? false
  const canEdit =
    puedeGestionarBase ||
    ctx?.userRole === 'full_access_main' ||
    ctx?.userRole === 'full_access_branch'

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

  // modal checklist categoría
  const [modalChecklistCat, setModalChecklistCat] = useState<ModalChecklistCat | null>(null)
  const [savingChecklistCat, setSavingChecklistCat] = useState(false)
  const [errorChecklistCat, setErrorChecklistCat] = useState<string | null>(null)

  // estado para sub-niveles abiertos (4to nivel)
  const [openChecklistCats, setOpenChecklistCats] = useState<Set<string>>(new Set())

  // modal editor de contenido (secciones e ítems) de un checklist
  const [editorContenido, setEditorContenido] = useState<{ gestionId: string; nombre: string } | null>(null)

  const grupos = data?.grupos ?? []
  const categorias = data?.categorias ?? []
  const gestiones = data?.gestiones ?? []
  const checklistCategorias = data?.checklistCategorias ?? []

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

  /**
   * Un item de la librería es editable si:
   * - es propio (consultora_id !== null) y el usuario tiene canEdit, O
   * - es base (consultora_id === null) y el usuario puede gestionar librerías base.
   */
  function esEditable(consultoraId: string | null): boolean {
    if (consultoraId !== null) return canEdit
    return puedeGestionarBase
  }

  function abrirNuevaGestion(categoriaId = '', grupoId = '', checklistCategoriaId = '') {
    setModalGestion({
      mode: 'crear',
      nombre: '', grupoId, categoriaId, checklistCategoriaId, descripcion: '',
      alcance: 'propia',
      inlineGrupoNombre: '', inlineCatNombre: '', inlineCatDesc: '',
      inlineStep: 'none',
    })
    setErrorGestion(null)
  }

  function abrirEditarGestion(g: { id: string; nombre: string; categoria_id: string; checklist_categoria_id: string | null; descripcion: string | null }) {
    const cat = categorias.find(c => c.id === g.categoria_id)
    setModalGestion({
      mode: 'editar', id: g.id,
      nombre: g.nombre,
      grupoId: cat?.grupo_id ?? '',
      categoriaId: g.categoria_id,
      checklistCategoriaId: g.checklist_categoria_id ?? '',
      descripcion: g.descripcion ?? '',
      alcance: 'propia', // no usado en editar
      inlineGrupoNombre: '', inlineCatNombre: '', inlineCatDesc: '',
      inlineStep: 'none',
    })
    setErrorGestion(null)
  }

  // ─── submit modal editar grupo/cat ──────────────────────────────────────────

  async function submitEditar() {
    if (!modalEditar) return
    setSavingEditar(true); setErrorEditar(null)

    if (!modalEditar.id) {
      // Crear
      const asBase = puedeGestionarBase && modalEditar.alcance === 'base'
      const res = modalEditar.nivel === 'grupo'
        ? await createGrupoGestion(modalEditar.nombre, asBase)
        : await createCategoriaGestion(modalEditar.nombre, modalEditar.grupoId, modalEditar.descripcion, asBase)
      setSavingEditar(false)
      if (!res.success) { setErrorEditar(res.error ?? 'Error'); return }
      setModalEditar(null); refetch()
    } else {
      // Editar
      const res = modalEditar.nivel === 'grupo'
        ? await updateGrupoGestion(modalEditar.id, modalEditar.nombre)
        : await updateCategoriaGestion(modalEditar.id, modalEditar.nombre, modalEditar.grupoId, modalEditar.descripcion)
      setSavingEditar(false)
      if (!res.success) { setErrorEditar(res.error ?? 'Error'); return }
      setModalEditar(null); refetch()
    }
  }

  // ─── submit modal gestión ───────────────────────────────────────────────────

  async function submitGestion() {
    if (!modalGestion) return
    setSavingGestion(true); setErrorGestion(null)
    const asBase = puedeGestionarBase && modalGestion.alcance === 'base'
    const ccId = modalGestion.checklistCategoriaId || null
    const res = modalGestion.mode === 'crear'
      ? await createGestion(modalGestion.nombre, modalGestion.categoriaId, modalGestion.descripcion, asBase, ccId)
      : await updateGestion(modalGestion.id!, modalGestion.nombre, modalGestion.categoriaId, modalGestion.descripcion, ccId)
    setSavingGestion(false)
    if (!res.success) { setErrorGestion(res.error ?? 'Error'); return }
    setModalGestion(null); refetch()
  }

  // ─── crear grupo inline ─────────────────────────────────────────────────────

  async function crearGrupoInline() {
    if (!modalGestion || !modalGestion.inlineGrupoNombre.trim()) return
    setSavingGestion(true); setErrorGestion(null)
    // El grupo inline hereda el alcance del modal de gestión
    const asBase = puedeGestionarBase && modalGestion.alcance === 'base'
    const res = await createGrupoGestion(modalGestion.inlineGrupoNombre.trim(), asBase)
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
    const asBase = puedeGestionarBase && modalGestion.alcance === 'base'
    const res = await createCategoriaGestion(
      modalGestion.inlineCatNombre.trim(),
      modalGestion.grupoId,
      modalGestion.inlineCatDesc.trim() || undefined,
      asBase,
    )
    setSavingGestion(false)
    if (!res.success) { setErrorGestion(res.error ?? 'Error'); return }
    await refetch()
    setModalGestion(g => g
      ? { ...g, categoriaId: res.data.id, inlineCatNombre: '', inlineCatDesc: '', inlineStep: 'none' }
      : g
    )
  }

  // ─── submit modal checklist-cat ─────────────────────────────────────────────

  async function submitChecklistCat() {
    if (!modalChecklistCat) return
    setSavingChecklistCat(true); setErrorChecklistCat(null)
    const asBase = puedeGestionarBase && modalChecklistCat.alcance === 'base'
    const res = !modalChecklistCat.id
      ? await createChecklistCategoria(modalChecklistCat.nombre, modalChecklistCat.categoriaId, modalChecklistCat.descripcion, asBase)
      : await updateChecklistCategoria(modalChecklistCat.id, modalChecklistCat.nombre, modalChecklistCat.descripcion)
    setSavingChecklistCat(false)
    if (!res.success) { setErrorChecklistCat(res.error ?? 'Error'); return }
    setModalChecklistCat(null); refetch()
  }

  // ─── eliminar ────────────────────────────────────────────────────────────────

  async function eliminar(nivel: Nivel, id: string, esBase: boolean) {
    const tipo = esBase ? 'base' : 'propio/a'
    const msg = nivel === 'grupo'
      ? `¿Eliminar este grupo ${tipo}? Se borran también sus categorías y gestiones ${tipo}s.`
      : nivel === 'categoria'
        ? `¿Eliminar esta categoría ${tipo}? Se borran también sus gestiones ${tipo}s.`
        : nivel === 'checklist-cat'
          ? `¿Eliminar esta categoría checklist ${tipo}? Los checklists de esta sub-categoría quedarán sin sub-categoría asignada.`
          : `¿Eliminar esta gestión ${tipo}?`
    if (!confirm(msg)) return
    const res = nivel === 'grupo' ? await deleteGrupoGestion(id)
      : nivel === 'categoria' ? await deleteCategoriaGestion(id)
        : nivel === 'checklist-cat' ? await deleteChecklistCategoria(id)
          : await deleteGestion(id)
    if (!res.success) { alert(res.error); return }
    refetch()
  }

  if (isLoading) return <div className="p-8 text-text-tertiary">Cargando…</div>

  // ─── categorías filtradas por grupo seleccionado (modal gestión) ─────────────
  const catsPorGrupo = modalGestion?.grupoId
    ? categorias.filter(c => c.grupo_id === modalGestion.grupoId)
    : []

  // ─── checklist-categorías filtradas por categoría seleccionada (modal gestión) ─
  const ccsPorCat = modalGestion?.categoriaId
    ? checklistCategorias.filter(cc => cc.categoria_id === modalGestion.categoriaId)
    : []

  // ¿la categoría seleccionada en el modal tiene sub-niveles? (determina si mostrar el selector)
  const catSeleccionadaTieneSubs = ccsPorCat.length > 0

  // Al crear en modo base, el sub-form "nuevo grupo" no está limitado por gruposPropios
  const puedeCrearGrupoInline = modalGestion
    ? (modalGestion.alcance === 'base' && puedeGestionarBase) || gruposPropios < LIMITE_GRUPOS
    : false
  const puedeCrearCatInline = modalGestion
    ? (modalGestion.alcance === 'base' && puedeGestionarBase) || catPropias < LIMITE_CATEGORIAS
    : false

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
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
            const editableG = esEditable(grupo.consultora_id)
            return (
              <div key={grupo.id} className="border border-border-subtle rounded-lg bg-surface-base">
                <div className="flex items-center gap-1 sm:gap-2 p-2.5 sm:p-3">
                  <button onClick={() => toggle(openGrupos, setOpenGrupos, grupo.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {abierto ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <span className="font-semibold truncate">{grupo.nombre}</span>
                    <OrigenBadge consultoraId={grupo.consultora_id} />
                    <span className="text-xs text-text-tertiary shrink-0">({cats.length})</span>
                  </button>
                  {editableG && (
                    <>
                      <button
                        onClick={() => setModalEditar({ nivel: 'grupo', id: grupo.id, nombre: grupo.nombre, grupoId: '', descripcion: '', alcance: 'propia' })}
                        className="shrink-0 p-1.5 -m-0.5 rounded text-text-tertiary hover:text-text-primary"
                        title="Editar grupo"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminar('grupo', grupo.id, grupo.consultora_id === null)} className="shrink-0 p-1.5 -m-0.5 rounded text-red-400 hover:text-danger" title="Eliminar grupo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {abierto && (
                  <div className="px-2.5 pb-3 pl-5 sm:px-3 sm:pl-8 space-y-2">
                    {canEdit && (
                      <Button variant="secondary" size="sm" onClick={() => abrirNuevaGestion('', grupo.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nueva gestión en este grupo
                      </Button>
                    )}
                    {cats.map(cat => {
                      const gests = gestVis.filter(g => g.categoria_id === cat.id)
                      const abiertaC = openCats.has(cat.id)
                      const editableC = esEditable(cat.consultora_id)
                      // 4to nivel: sub-categorías checklist de esta categoría
                      const ccsDeCat = checklistCategorias.filter(cc => cc.categoria_id === cat.id)
                      const tieneSubs = ccsDeCat.length > 0
                      return (
                        <div key={cat.id} className="border border-border-subtle rounded-lg">
                          <div className="flex items-center gap-1 sm:gap-2 p-2.5">
                            <button onClick={() => toggle(openCats, setOpenCats, cat.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                              {abiertaC ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                              <span className="font-medium text-sm truncate">{cat.nombre}</span>
                              <OrigenBadge consultoraId={cat.consultora_id} />
                              <span className="text-xs text-text-tertiary shrink-0">({gests.length})</span>
                            </button>
                            {editableC && (
                              <>
                                <button
                                  onClick={() => setModalEditar({ nivel: 'categoria', id: cat.id, nombre: cat.nombre, grupoId: cat.grupo_id, descripcion: cat.descripcion ?? '', alcance: 'propia' })}
                                  className="shrink-0 p-1.5 -m-0.5 rounded text-text-tertiary hover:text-text-primary"
                                  title="Editar categoría"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => eliminar('categoria', cat.id, cat.consultora_id === null)} className="shrink-0 p-1.5 -m-0.5 rounded text-red-400 hover:text-danger" title="Eliminar categoría">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                          {abiertaC && (
                            <div className="px-2 pb-2.5 pl-4 sm:px-2.5 sm:pl-7 space-y-1">
                              {canEdit && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {!tieneSubs && (
                                    <Button variant="secondary" size="sm" onClick={() => abrirNuevaGestion(cat.id, cat.grupo_id)}>
                                      <Plus className="w-3.5 h-3.5 mr-1" /> Nueva gestión
                                    </Button>
                                  )}
                                  {/* Botón para crear sub-categoría checklist */}
                                  {tieneSubs && (
                                    <Button variant="secondary" size="sm" onClick={() => {
                                      setModalChecklistCat({ id: '', categoriaId: cat.id, nombre: '', descripcion: '', alcance: 'propia' })
                                      setErrorChecklistCat(null)
                                    }}>
                                      <Plus className="w-3.5 h-3.5 mr-1" /> Nueva sub-categoría
                                    </Button>
                                  )}
                                </div>
                              )}

                              {/* ── 4to nivel: sub-categorías checklist ── */}
                              {tieneSubs && ccsDeCat.map(cc => {
                                const gestsDeCC = gestVis.filter(g => g.checklist_categoria_id === cc.id)
                                const abiertaCC = openChecklistCats.has(cc.id)
                                const editableCC = esEditable(cc.consultora_id)
                                return (
                                  <div key={cc.id} className="border border-border-subtle rounded-lg bg-surface-elevated/30">
                                    <div className="flex items-center gap-1 sm:gap-2 p-2">
                                      <button
                                        onClick={() => toggle(openChecklistCats, setOpenChecklistCats, cc.id)}
                                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                      >
                                        {abiertaCC ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-text-tertiary" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-text-tertiary" />}
                                        <span className="text-sm font-medium truncate text-text-secondary">{cc.nombre}</span>
                                        <OrigenBadge consultoraId={cc.consultora_id} />
                                        <span className="text-xs text-text-tertiary shrink-0">({gestsDeCC.length})</span>
                                      </button>
                                      {editableCC && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setModalChecklistCat({ id: cc.id, categoriaId: cc.categoria_id, nombre: cc.nombre, descripcion: cc.descripcion ?? '', alcance: 'propia' })
                                              setErrorChecklistCat(null)
                                            }}
                                            className="shrink-0 p-1.5 -m-0.5 rounded text-text-tertiary hover:text-text-primary"
                                            title="Editar sub-categoría"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => eliminar('checklist-cat', cc.id, cc.consultora_id === null)}
                                            className="shrink-0 p-1.5 -m-0.5 rounded text-red-400 hover:text-danger"
                                            title="Eliminar sub-categoría"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    {abiertaCC && (
                                      <div className="px-2 pb-2 pl-5 space-y-1">
                                        {canEdit && (
                                          <Button variant="secondary" size="sm" onClick={() => abrirNuevaGestion(cat.id, cat.grupo_id, cc.id)}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo checklist
                                          </Button>
                                        )}
                                        {gestsDeCC.map(g => {
                                          const editableGe = esEditable(g.consultora_id)
                                          return (
                                            <div key={g.id} className="flex items-center gap-1 sm:gap-2 py-1.5 px-2 rounded hover:bg-surface-elevated">
                                              <span className="flex-1 min-w-0 text-sm truncate">{g.nombre}</span>
                                              <OrigenBadge consultoraId={g.consultora_id} />
                                              <button
                                                onClick={() => setEditorContenido({ gestionId: g.id, nombre: g.nombre })}
                                                className="shrink-0 p-1.5 -m-0.5 rounded text-text-tertiary hover:text-brand-primary"
                                                title="Ver / editar ítems del checklist"
                                              >
                                                <ListChecks className="w-3.5 h-3.5" />
                                              </button>
                                              {editableGe && (
                                                <>
                                                  <button onClick={() => abrirEditarGestion(g)} className="shrink-0 p-1.5 -m-0.5 rounded text-text-tertiary hover:text-text-primary" title="Editar checklist">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button onClick={() => eliminar('gestion', g.id, g.consultora_id === null)} className="shrink-0 p-1.5 -m-0.5 rounded text-red-400 hover:text-danger" title="Eliminar checklist">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          )
                                        })}
                                        {gestsDeCC.length === 0 && <p className="text-xs text-text-tertiary py-1">Sin checklists.</p>}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                              {/* ── 3 niveles normales (sin sub-niveles) ── */}
                              {!tieneSubs && gests.map(g => {
                                const editableGe = esEditable(g.consultora_id)
                                return (
                                  <div key={g.id} className="flex items-center gap-1 sm:gap-2 py-1.5 px-2 rounded hover:bg-surface-elevated">
                                    <span className="flex-1 min-w-0 text-sm truncate">{g.nombre}</span>
                                    <OrigenBadge consultoraId={g.consultora_id} />
                                    {editableGe && (
                                      <>
                                        <button onClick={() => abrirEditarGestion(g)} className="shrink-0 p-1.5 -m-0.5 rounded text-text-tertiary hover:text-text-primary" title="Editar gestión">
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => eliminar('gestion', g.id, g.consultora_id === null)} className="shrink-0 p-1.5 -m-0.5 rounded text-red-400 hover:text-danger" title="Eliminar gestión">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                              {!tieneSubs && gests.length === 0 && <p className="text-xs text-text-tertiary py-1">Sin gestiones.</p>}
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
              {(gruposPropios < LIMITE_GRUPOS || puedeGestionarBase) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalEditar({ nivel: 'grupo', id: '', nombre: '', grupoId: '', descripcion: '', alcance: 'propia' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo grupo
                </Button>
              )}
              {gruposPropios >= LIMITE_GRUPOS && !puedeGestionarBase && (
                <span className="text-xs text-text-tertiary">Límite alcanzado</span>
              )}
            </div>

            <div className="border border-border-subtle rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
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
                    const editable = esEditable(g.consultora_id)
                    return (
                      <tr key={g.id} className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">{g.nombre}</td>
                        <td className="px-4 py-3"><OrigenBadge consultoraId={g.consultora_id} /></td>
                        <td className="px-4 py-3 text-text-secondary">{nCats}</td>
                        <td className="px-4 py-3">
                          {editable ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => setModalEditar({ nivel: 'grupo', id: g.id, nombre: g.nombre, grupoId: '', descripcion: '', alcance: 'propia' })}
                                className="p-1.5 rounded text-text-tertiary hover:text-text-primary"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminar('grupo', g.id, g.consultora_id === null)} className="p-1.5 rounded text-red-400 hover:text-danger" title="Eliminar">
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
            {gruposPropios >= LIMITE_GRUPOS && !puedeGestionarBase && (
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
              {(catPropias < LIMITE_CATEGORIAS || puedeGestionarBase) ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalEditar({ nivel: 'categoria', id: '', nombre: '', grupoId: grupos[0]?.id ?? '', descripcion: '', alcance: 'propia' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nueva categoría
                </Button>
              ) : (
                <span className="text-xs text-text-tertiary">Límite alcanzado</span>
              )}
            </div>

            <div className="border border-border-subtle rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
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
                    const editable = esEditable(c.consultora_id)
                    return (
                      <tr key={c.id} className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-text-primary">{c.nombre}</td>
                        <td className="px-4 py-3 text-text-secondary">{grupoNombre}</td>
                        <td className="px-4 py-3"><OrigenBadge consultoraId={c.consultora_id} /></td>
                        <td className="px-4 py-3">
                          {editable ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => setModalEditar({ nivel: 'categoria', id: c.id, nombre: c.nombre, grupoId: c.grupo_id, descripcion: c.descripcion ?? '', alcance: 'propia' })}
                                className="p-1.5 rounded text-text-tertiary hover:text-text-primary"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminar('categoria', c.id, c.consultora_id === null)} className="p-1.5 rounded text-red-400 hover:text-danger" title="Eliminar">
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
            {catPropias >= LIMITE_CATEGORIAS && !puedeGestionarBase && (
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

            {/* Select de alcance — solo al crear y solo para base-librarians */}
            {!modalEditar.id && puedeGestionarBase && (
              <AlcanceSelect
                value={modalEditar.alcance}
                onChange={v => setModalEditar({ ...modalEditar, alcance: v })}
              />
            )}

            {/* Aviso modo editar: si la fila es base */}
            {modalEditar.id && modalEditar.nivel === 'grupo' && !modalEditar.id && null}

            {modalEditar.nivel === 'grupo' && !modalEditar.id && (
              <p className="text-xs text-text-tertiary bg-surface-elevated rounded-lg p-3">
                Un grupo debe ser un <strong>concepto genérico</strong> (como Auditorías, Formaciones, Reuniones).
                {modalEditar.alcance === 'propia'
                  ? ` El máximo de ${LIMITE_GRUPOS} grupos propios existe para conservar el orden y que los reportes sean comparables entre consultoras.`
                  : ' Los grupos base están disponibles para todas las consultoras de la plataforma.'}
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
                onClick={submitEditar}
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

            {/* Select de alcance — solo al crear y solo para base-librarians */}
            {modalGestion.mode === 'crear' && puedeGestionarBase && (
              <AlcanceSelect
                value={modalGestion.alcance}
                onChange={v => setModalGestion({ ...modalGestion, alcance: v })}
              />
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
                {/* Botón crear nuevo grupo — solo si no estamos en sub-form y hay lugar (o es base-librarian en modo base) */}
                {modalGestion.inlineStep !== 'nuevo-grupo' && puedeCrearGrupoInline && (
                  <button
                    type="button"
                    onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'nuevo-grupo', inlineGrupoNombre: '' })}
                    className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Crear nuevo
                  </button>
                )}
                {modalGestion.inlineStep !== 'nuevo-grupo' && !puedeCrearGrupoInline && (
                  <span className="text-xs text-red-500">Límite de {LIMITE_GRUPOS} grupos propios alcanzado</span>
                )}
              </div>

              {/* Sub-form inline: nuevo grupo */}
              {modalGestion.inlineStep === 'nuevo-grupo' && (
                <div className="bg-surface-elevated border border-border-subtle rounded-lg p-3 mb-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                      Nuevo grupo{modalGestion.alcance === 'base' ? ' (base)' : ''}
                    </span>
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
                  {modalGestion.inlineStep !== 'nueva-cat' && puedeCrearCatInline && (
                    <button
                      type="button"
                      onClick={() => setModalGestion({ ...modalGestion, inlineStep: 'nueva-cat', inlineCatNombre: '', inlineCatDesc: '' })}
                      className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Crear nueva
                    </button>
                  )}
                  {modalGestion.inlineStep !== 'nueva-cat' && !puedeCrearCatInline && (
                    <span className="text-xs text-red-500">Límite de {LIMITE_CATEGORIAS} categorías propias alcanzado</span>
                  )}
                </div>

                {/* Sub-form inline: nueva categoría */}
                {modalGestion.inlineStep === 'nueva-cat' && (
                  <div className="bg-surface-elevated border border-border-subtle rounded-lg p-3 mb-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        Nueva categoría{modalGestion.alcance === 'base' ? ' (base)' : ''} en «{grupos.find(g => g.id === modalGestion.grupoId)?.nombre}»
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
                  onChange={e => setModalGestion({ ...modalGestion, categoriaId: e.target.value, checklistCategoriaId: '' })}
                >
                  <option value="">Seleccioná una categoría…</option>
                  {catsPorGrupo.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.consultora_id === null ? ' (base)' : ''}</option>
                  ))}
                </select>
                {catsPorGrupo.length === 0 && (
                  <p className="text-xs text-text-tertiary mt-1">
                    No hay categorías en este grupo.
                    {puedeCrearCatInline ? ' Creá una nueva con el botón de arriba.' : ''}
                  </p>
                )}
              </div>
            )}

            {/* ── Paso 3: Sub-categoría checklist (solo si la categoría tiene sub-niveles) ── */}
            {modalGestion.categoriaId && catSeleccionadaTieneSubs && (
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Sub-categoría checklist *</label>
                <select
                  className={inputCls}
                  value={modalGestion.checklistCategoriaId}
                  onChange={e => setModalGestion({ ...modalGestion, checklistCategoriaId: e.target.value })}
                >
                  <option value="">Seleccioná una sub-categoría…</option>
                  {ccsPorCat.map(cc => (
                    <option key={cc.id} value={cc.id}>{cc.nombre}{cc.consultora_id === null ? ' (base)' : ''}</option>
                  ))}
                </select>
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
                  (catSeleccionadaTieneSubs && !modalGestion.checklistCategoriaId) ||
                  modalGestion.inlineStep !== 'none'
                }
              >
                {savingGestion ? 'Guardando…' : 'Guardar gestión'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EDITOR: secciones e ítems de un checklist                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <ChecklistContenidoEditor
        open={editorContenido !== null}
        onClose={() => setEditorContenido(null)}
        gestionId={editorContenido?.gestionId ?? ''}
        gestionNombre={editorContenido?.nombre ?? ''}
      />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: nueva / editar categoría checklist (4to nivel)                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalChecklistCat !== null}
        onClose={() => { setModalChecklistCat(null); setErrorChecklistCat(null) }}
        title={modalChecklistCat ? (!modalChecklistCat.id ? 'Nueva sub-categoría' : 'Editar sub-categoría') : ''}
      >
        {modalChecklistCat && (
          <div className="flex flex-col gap-4">
            {errorChecklistCat && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{errorChecklistCat}</div>
            )}

            {/* Select de alcance — solo al crear y solo para base-librarians */}
            {!modalChecklistCat.id && puedeGestionarBase && (
              <AlcanceSelect
                value={modalChecklistCat.alcance}
                onChange={v => setModalChecklistCat({ ...modalChecklistCat, alcance: v })}
              />
            )}

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
              <input
                className={inputCls}
                value={modalChecklistCat.nombre}
                onChange={e => setModalChecklistCat({ ...modalChecklistCat, nombre: e.target.value })}
                autoFocus
                placeholder="ej. Trabajos en altura"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Descripción</label>
              <textarea
                className={inputCls}
                rows={2}
                value={modalChecklistCat.descripcion}
                onChange={e => setModalChecklistCat({ ...modalChecklistCat, descripcion: e.target.value })}
                placeholder="Opcional…"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setModalChecklistCat(null); setErrorChecklistCat(null) }}>Cancelar</Button>
              <Button
                onClick={submitChecklistCat}
                disabled={savingChecklistCat || !modalChecklistCat.nombre.trim()}
              >
                {savingChecklistCat ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
